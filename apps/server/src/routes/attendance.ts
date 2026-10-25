import { Hono } from 'hono';
import { AttendanceSessionService } from '../services/attendance-session.service';
import { AttendanceRecordService } from '../services/attendance-record.service';
import { BleAttendanceService } from '../services/ble-attendance.service';
import { attendanceAuthService } from '../services/attendance-auth.service';
import { requireLinkedAttendanceStaff, requireStaffOrAdmin } from '../middlewares/auth.middleware';
import type { AuthPrincipal } from '@smart-attendance/shared';
import { getDateInTimeZone } from '../utils/date';

export const attendanceRoutes = new Hono();
const service = new AttendanceSessionService();
const recordService = new AttendanceRecordService();
const bleService = new BleAttendanceService();

function getActor(c: any, user: AuthPrincipal) {
  return {
    actorId: user.roles.includes('FACULTY') ? undefined : user.id,
    actorName: user.name,
    actorRole: user.roles[0] || 'STAFF',
    ipAddress: c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || '127.0.0.1',
    userAgent: c.req.header('user-agent'),
  };
}

attendanceRoutes.post('/sessions/start', requireStaffOrAdmin, requireLinkedAttendanceStaff, async (c) => {
  try {
    const user = c.get('user') as AuthPrincipal;
    const body = await c.req.json();
    const { timetableId, date } = body;
    
    // Derive staffId from authenticated principal unless administrative override
    const isLeadership = attendanceAuthService.isLeadership(user);
    const effectiveStaffId = isLeadership && body.staffId ? body.staffId : user.id;

    if (!timetableId || !date) {
      return c.json({ success: false, error: { message: "Missing required fields: timetableId and date." } }, 400);
    }

    const actor = getActor(c, user);
    const session = await service.startSession(timetableId, effectiveStaffId, date, actor);
    return c.json({ success: true, data: session }, 201);
  } catch (error: any) {
    if (error.message === "STAFF_NOT_AUTHORIZED") {
      return c.json({ success: false, error: { message: "You are not authorized to start attendance for this timetable slot." } }, 403);
    }
    if (error.message === "TIMETABLE_NOT_FOUND") {
      return c.json({ success: false, error: { message: "Timetable entry not found." } }, 404);
    }
    if (error.message === "SESSION_ALREADY_EXISTS") {
      return c.json({ success: false, error: { message: "A session for this timetable and date already exists." } }, 409);
    }
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

attendanceRoutes.post('/sessions/:id/end', requireStaffOrAdmin, requireLinkedAttendanceStaff, async (c) => {
  try {
    const user = c.get('user') as AuthPrincipal;
    const { id } = c.req.param();
    const existing = await service.getSession(id);
    if (!existing) {
      return c.json({ success: false, error: { message: "Attendance session not found." } }, 404);
    }
    const canMutate = await attendanceAuthService.canMutateSession(user, existing);
    if (!canMutate) {
      return c.json({ success: false, error: { message: "Access denied. You are not authorized to end this session." } }, 403);
    }
    const actor = getActor(c, user);
    const session = await service.endSession(id, actor);
    return c.json({ success: true, data: session });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

attendanceRoutes.post('/sessions/:id/cancel', requireStaffOrAdmin, requireLinkedAttendanceStaff, async (c) => {
  try {
    const user = c.get('user') as AuthPrincipal;
    const { id } = c.req.param();
    const existing = await service.getSession(id);
    if (!existing) {
      return c.json({ success: false, error: { message: "Attendance session not found." } }, 404);
    }
    const canMutate = await attendanceAuthService.canMutateSession(user, existing);
    if (!canMutate) {
      return c.json({ success: false, error: { message: "Access denied. You are not authorized to cancel this session." } }, 403);
    }
    const body = await c.req.json();
    const actor = getActor(c, user);
    const session = await service.cancelSession(id, body.reason, actor);
    return c.json({ success: true, data: session });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

attendanceRoutes.get('/sessions', requireStaffOrAdmin, async (c) => {
  try {
    const user = c.get('user') as AuthPrincipal;
    const query = c.req.query();
    
    // Non-leadership must have authorized class access
    if (!attendanceAuthService.isLeadership(user)) {
      if (query.classId) {
        const canAccess = await attendanceAuthService.canAccessClass(user, query.classId);
        if (!canAccess) {
          return c.json({ success: false, error: { message: "Access denied: You are not authorized to view sessions for this class." } }, 403);
        }
      } else {
        query.staffId = user.id;
      }
    }
    const sessions = await service.getSessions(query);
    return c.json({ success: true, data: sessions });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

attendanceRoutes.get('/sessions/stats', requireStaffOrAdmin, async (c) => {
  try {
    const date = c.req.query('date') || getDateInTimeZone();
    const stats = await service.getStats(date);
    return c.json({ success: true, data: stats });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

attendanceRoutes.get('/sessions/:id', requireStaffOrAdmin, async (c) => {
  try {
    const user = c.get('user') as AuthPrincipal;
    const { id } = c.req.param();
    const session = await service.getSession(id);
    if (!session) return c.json({ success: false, error: { message: "Session not found." } }, 404);
    const canAccess = await attendanceAuthService.canAccessSession(user, session);
    if (!canAccess) {
      return c.json({ success: false, error: { message: "Access denied: You are not authorized to view this session." } }, 403);
    }
    return c.json({ success: true, data: session });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

attendanceRoutes.post('/sessions/:id/ble/start', requireStaffOrAdmin, requireLinkedAttendanceStaff, async (c) => {
  try {
    const user = c.get('user') as AuthPrincipal;
    const { id } = c.req.param();
    const existing = await service.getSession(id);
    if (!existing) return c.json({ success: false, error: { message: "Session not found." } }, 404);
    const canMutate = await attendanceAuthService.canMutateSession(user, existing);
    if (!canMutate) {
      return c.json({ success: false, error: { message: "Access denied: You are not authorized to start BLE for this session." } }, 403);
    }
    const result = await bleService.startBleSession(id);
    return c.json(result);
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

attendanceRoutes.post('/sessions/:id/ble/stop', requireStaffOrAdmin, requireLinkedAttendanceStaff, async (c) => {
  try {
    const user = c.get('user') as AuthPrincipal;
    const { id } = c.req.param();
    const existing = await service.getSession(id);
    if (!existing) return c.json({ success: false, error: { message: "Session not found." } }, 404);
    const canMutate = await attendanceAuthService.canMutateSession(user, existing);
    if (!canMutate) {
      return c.json({ success: false, error: { message: "Access denied: You are not authorized to stop BLE for this session." } }, 403);
    }
    const result = await bleService.stopBleSession(id);
    return c.json(result);
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

attendanceRoutes.post('/sessions/:id/ble/detections', requireStaffOrAdmin, requireLinkedAttendanceStaff, async (c) => {
  try {
    const user = c.get('user') as AuthPrincipal;
    const { id } = c.req.param();
    const existing = await service.getSession(id);
    if (!existing) return c.json({ success: false, error: { message: "Session not found." } }, 404);
    const canMutate = await attendanceAuthService.canMutateSession(user, existing);
    if (!canMutate) {
      return c.json({ success: false, error: { message: "Access denied: You are not authorized to submit detections for this session." } }, 403);
    }
    const body = await c.req.json();
    if (!body.detections || !Array.isArray(body.detections)) {
      return c.json({ success: false, error: { message: "Invalid payload: detections must be an array." } }, 400);
    }
    const result = await bleService.processDetections(id, body.detections);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

attendanceRoutes.get('/sessions/:id/live', requireStaffOrAdmin, async (c) => {
  try {
    const user = c.get('user') as AuthPrincipal;
    const { id } = c.req.param();
    const existing = await service.getSession(id);
    if (!existing) return c.json({ success: false, error: { message: "Session not found." } }, 404);
    const canAccess = await attendanceAuthService.canAccessSession(user, existing);
    if (!canAccess) {
      return c.json({ success: false, error: { message: "Access denied: You are not authorized to view live attendance for this session." } }, 403);
    }
    const data = await bleService.getLiveAttendance(id);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

// GET /api/attendance/records
attendanceRoutes.get("/records", requireStaffOrAdmin, async (c) => {
  try {
    const user = c.get("user") as AuthPrincipal;
    const sessionId = c.req.query("sessionId");
    const studentId = c.req.query("studentId");
    const classId = c.req.query("classId");
    const date = c.req.query("date");
    const status = c.req.query("status");

    if (!attendanceAuthService.isLeadership(user)) {
      if (classId) {
        const canAccess = await attendanceAuthService.canAccessClass(user, classId);
        if (!canAccess) {
          return c.json({ success: false, error: { message: "Access denied: You are not authorized to view records for this class." } }, 403);
        }
      } else if (sessionId) {
        const session = await service.getSession(sessionId);
        if (!session) return c.json({ success: false, error: { message: "Session not found." } }, 404);
        const canAccess = await attendanceAuthService.canAccessSession(user, session);
        if (!canAccess) {
          return c.json({ success: false, error: { message: "Access denied: You are not authorized to view records for this session." } }, 403);
        }
      } else {
        const counselorClassIds = await attendanceAuthService.getCounselorClassIds(user);
        if (counselorClassIds.length > 0) {
          return c.json({
            success: true,
            data: await recordService.getRecords({ classId: counselorClassIds[0], date, status }),
          });
        }
        return c.json({ success: false, error: { message: "Specify classId or sessionId to query records." } }, 400);
      }
    }

    const data = await recordService.getRecords({ sessionId, studentId, classId, date, status });
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

// GET /api/attendance/records/:id
attendanceRoutes.get("/records/:id", requireStaffOrAdmin, async (c) => {
  try {
    const user = c.get("user") as AuthPrincipal;
    const id = c.req.param("id")!;
    const data = await recordService.getRecordById(id);
    if (!data) return c.json({ success: false, error: { message: "Record not found" } }, 404);
    if (!attendanceAuthService.isLeadership(user)) {
      const canAccess = await attendanceAuthService.canAccessClass(user, data.classId);
      if (!canAccess) {
        return c.json({ success: false, error: { message: "Access denied: You are not authorized to view this attendance record." } }, 403);
      }
    }
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 404);
  }
});

// POST /api/attendance/corrections
attendanceRoutes.post("/corrections", requireStaffOrAdmin, requireLinkedAttendanceStaff, async (c) => {
  try {
    const user = c.get("user") as AuthPrincipal;
    const body = await c.req.json();
    const { recordId, newStatus, reason } = body;

    if (!recordId) {
      return c.json({ success: false, error: { message: "Missing recordId." } }, 400);
    }
    const existing = await recordService.getRecordById(recordId);
    if (!existing) {
      return c.json({ success: false, error: { message: "Attendance record not found." } }, 404);
    }

    const canMutate = await attendanceAuthService.canMutateRecord(user, existing);
    if (!canMutate) {
      return c.json({ success: false, error: { message: "Access denied: You are not authorized to correct attendance for this class/record." } }, 403);
    }

    const actor = getActor(c, user);
    const data = await recordService.correctAttendance({
      recordId,
      newStatus,
      reason,
      actor,
    });

    return c.json({ success: true, data });
  } catch (error: any) {
    if (error.message === "STATUS_UNCHANGED") {
      return c.json({ success: false, error: { message: "Status is unchanged." } }, 409);
    }
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

// POST /api/attendance/records/manual
attendanceRoutes.post("/records/manual", requireStaffOrAdmin, requireLinkedAttendanceStaff, async (c) => {
  try {
    const user = c.get("user") as AuthPrincipal;
    const body = await c.req.json();
    const { sessionId, studentId, status, reason } = body;

    if (!sessionId || !studentId) {
      return c.json({ success: false, error: { message: "Missing required fields: sessionId and studentId." } }, 400);
    }

    const session = await service.getSession(sessionId);
    if (!session) {
      return c.json({ success: false, error: { message: "Attendance session not found." } }, 404);
    }

    const canMutate = await attendanceAuthService.canMutateRecord(user, {
      id: '',
      classId: session.classId,
      sessionId,
      studentId,
    });
    if (!canMutate) {
      return c.json({ success: false, error: { message: "Access denied: You are not authorized to manually mark attendance for this session/student." } }, 403);
    }

    const actor = getActor(c, user);
    const data = await recordService.manualMark({
      sessionId,
      studentId,
      status,
      reason,
      actor,
    });

    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});
