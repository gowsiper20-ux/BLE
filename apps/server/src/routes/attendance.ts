import { Hono } from 'hono';
import { AttendanceSessionService } from '../services/attendance-session.service';
import { AttendanceRecordService } from '../services/attendance-record.service';
import { requireStaffOrAdmin } from '../middlewares/auth.middleware';
import type { AuthPrincipal } from '@smart-attendance/shared';

export const attendanceRoutes = new Hono();
const service = new AttendanceSessionService();
const recordService = new AttendanceRecordService();

attendanceRoutes.post('/sessions/start', requireStaffOrAdmin, async (c) => {
  try {
    const user = c.get('user') as AuthPrincipal;
    const body = await c.req.json();
    const { timetableId, date } = body;
    
    // Derive staffId from authenticated principal unless administrative override
    const isLeadership = user.roles.some((r) => ['ADMIN', 'HOD', 'DEPUTY_HOD'].includes(r));
    const effectiveStaffId = isLeadership && body.staffId ? body.staffId : user.id;

    if (!timetableId || !date) {
      return c.json({ success: false, error: { message: "Missing required fields: timetableId and date." } }, 400);
    }

    const actor = {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.roles[0] || 'STAFF',
      ipAddress: c.req.header('x-forwarded-for') || undefined,
      userAgent: c.req.header('user-agent') || undefined,
    };

    const session = await service.startSession(timetableId, effectiveStaffId, date, actor);
    return c.json({ success: true, data: session }, 201);
  } catch (error: any) {
    if (error.message === "SESSION_ALREADY_EXISTS") {
      return c.json({ success: false, error: { message: error.message } }, 409);
    }
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

attendanceRoutes.post('/sessions/:id/end', requireStaffOrAdmin, async (c) => {
  try {
    const user = c.get('user') as AuthPrincipal;
    const { id } = c.req.param();
    const actor = {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.roles[0] || 'STAFF',
      ipAddress: c.req.header('x-forwarded-for') || undefined,
      userAgent: c.req.header('user-agent') || undefined,
    };
    const session = await service.endSession(id, actor);
    return c.json({ success: true, data: session });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

attendanceRoutes.post('/sessions/:id/cancel', requireStaffOrAdmin, async (c) => {
  try {
    const user = c.get('user') as AuthPrincipal;
    const { id } = c.req.param();
    const body = await c.req.json();
    const actor = {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.roles[0] || 'STAFF',
      ipAddress: c.req.header('x-forwarded-for') || undefined,
      userAgent: c.req.header('user-agent') || undefined,
    };
    const session = await service.cancelSession(id, body.reason, actor);
    return c.json({ success: true, data: session });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

attendanceRoutes.get('/sessions', async (c) => {
  try {
    const query = c.req.query();
    const sessions = await service.getSessions(query);
    return c.json({ success: true, data: sessions });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

attendanceRoutes.get('/sessions/stats', async (c) => {
  try {
    const date = c.req.query('date') || new Date().toISOString().split('T')[0];
    const stats = await service.getStats(date);
    return c.json({ success: true, data: stats });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

attendanceRoutes.get('/sessions/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const session = await service.getSession(id);
    if (!session) return c.json({ success: false, error: { message: "NOT_FOUND" } }, 404);
    return c.json({ success: true, data: session });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

import { BleAttendanceService } from '../services/ble-attendance.service';
const bleService = new BleAttendanceService();

attendanceRoutes.post('/sessions/:id/ble/start', async (c) => {
  try {
    const { id } = c.req.param();
    const result = await bleService.startBleSession(id);
    return c.json(result);
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

attendanceRoutes.post('/sessions/:id/ble/stop', async (c) => {
  try {
    const { id } = c.req.param();
    const result = await bleService.stopBleSession(id);
    return c.json(result);
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

attendanceRoutes.post('/sessions/:id/ble/detections', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    if (!body.detections || !Array.isArray(body.detections)) {
      return c.json({ success: false, error: { message: "Invalid payload" } }, 400);
    }
    const result = await bleService.processDetections(id, body.detections);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

attendanceRoutes.get('/sessions/:id/live', async (c) => {
  try {
    const { id } = c.req.param();
    const data = await bleService.getLiveAttendance(id);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

// GET /api/attendance/records
attendanceRoutes.get("/records", requireStaffOrAdmin, async (c) => {
  try {
    const sessionId = c.req.query("sessionId");
    const studentId = c.req.query("studentId");
    const classId = c.req.query("classId");
    const date = c.req.query("date");
    const status = c.req.query("status");

    const data = await recordService.getRecords({ sessionId, studentId, classId, date, status });
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

// GET /api/attendance/records/:id
attendanceRoutes.get("/records/:id", requireStaffOrAdmin, async (c) => {
  try {
    const id = c.req.param("id")!;
    const data = await recordService.getRecordById(id);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 404);
  }
});

// POST /api/attendance/corrections
attendanceRoutes.post("/corrections", requireStaffOrAdmin, async (c) => {
  try {
    const user = c.get("user") as AuthPrincipal;
    const body = await c.req.json();
    const { recordId, newStatus, reason } = body;

    const actor = {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.roles[0] || "STAFF",
      ipAddress: c.req.header("x-forwarded-for") || undefined,
      userAgent: c.req.header("user-agent") || undefined,
    };

    const data = await recordService.correctAttendance({
      recordId,
      newStatus,
      reason,
      actor,
    });

    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

// POST /api/attendance/records/manual
attendanceRoutes.post("/records/manual", requireStaffOrAdmin, async (c) => {
  try {
    const user = c.get("user") as AuthPrincipal;
    const body = await c.req.json();
    const { sessionId, studentId, status, reason } = body;

    const actor = {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.roles[0] || "STAFF",
      ipAddress: c.req.header("x-forwarded-for") || undefined,
      userAgent: c.req.header("user-agent") || undefined,
    };

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
