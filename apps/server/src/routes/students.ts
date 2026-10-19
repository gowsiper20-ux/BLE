import { Hono } from "hono";
import { StudentService } from "../services/student.service";
import { AttendanceSessionService } from "../services/attendance-session.service";
import { requireStudentAuth, requireStaffOrAdmin } from "../middlewares/auth.middleware";
import { BleTokenService } from "../services/ble-token.service";
import { StudentBleDeviceRepository } from '../repositories/student-ble-device.repository';

export const studentRoutes = new Hono<{ Variables: { student: any } }>();
const service = new StudentService();
const attendanceService = new AttendanceSessionService();
const bleTokenService = new BleTokenService();
const deviceRepo = new StudentBleDeviceRepository();

studentRoutes.use("*", async (c, next) => {
  const directoryMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(c.req.method);
  const operationalDeviceRoute = c.req.path.includes("/ble-devices");
  if (directoryMutation && !operationalDeviceRoute) {
    return c.json({
      success: false,
      error: { code: "DIRECTORY_READ_ONLY", message: "Student directory identities are read-only and managed by synchronization." },
    }, 405);
  }
  await next();
});

function handleStudentError(c: any, error: any) {
  const msg = error?.message || 'An unexpected error occurred.';
  if (
    msg.includes('already exists') ||
    msg.includes('Cannot delete') ||
    msg.includes('associated with this student')
  ) {
    return c.json({ success: false, error: { code: 'CONFLICT', message: msg } }, 409);
  }
  if (msg.includes('not found') || msg.includes('Not found')) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: msg } }, 404);
  }
  if (
    msg.includes('required') ||
    msg.includes('must belong to') ||
    msg.includes('Invalid') ||
    msg.includes('characters') ||
    msg.includes('Unsupported') ||
    msg.includes('empty') ||
    msg.includes('errors') ||
    msg.includes('Cannot import') ||
    msg.includes('No data provided')
  ) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: msg } }, 400);
  }
  return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: msg } }, 500);
}

studentRoutes.get("/", requireStaffOrAdmin, async (c) => {
  try {
    const search = c.req.query("search");
    const classId = c.req.query("classId");
    const departmentId = c.req.query("departmentId");
    const batchId = c.req.query("batchId");
    const status = c.req.query("status");
    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = parseInt(c.req.query("limit") || "20", 10);

    const data = await service.getStudents({ search, classId, departmentId, batchId, status, page, limit });
    return c.json({ success: true, data });
  } catch (error: any) {
    return handleStudentError(c, error);
  }
});

studentRoutes.get("/:id", requireStaffOrAdmin, async (c) => {
  try {
    const data = await service.getStudentById(c.req.param("id")!);
    if (!data) return c.json({ success: false, error: { code: 'NOT_FOUND', message: "Student not found" } }, 404);
    return c.json({ success: true, data });
  } catch (error: any) {
    return handleStudentError(c, error);
  }
});

// --- Mobile Student Attendance Endpoints ---

studentRoutes.get("/me/attendance/current", requireStudentAuth, async (c) => {
  try {
    const student = c.get('student');
    
    if (!student.classId) {
      return c.json({ success: true, session: null });
    }

    const today = new Date().toISOString().split('T')[0];
    
    const activeSessions = await attendanceService.getSessions({
      classId: student.classId,
      date: today,
      status: 'ACTIVE'
    });

    if (activeSessions && activeSessions.length > 0) {
      return c.json({ success: true, session: activeSessions[0] });
    }

    return c.json({ success: true, session: null });
  } catch (error: any) {
    return handleStudentError(c, error);
  }
});

studentRoutes.get("/me/attendance/ble-token", requireStudentAuth, async (c) => {
  try {
    const student = c.get('student');
    
    if (!student.classId) {
      return c.json({ success: true, token: null });
    }

    const today = new Date().toISOString().split('T')[0];
    
    const activeSessions = await attendanceService.getSessions({
      classId: student.classId,
      date: today,
      status: 'ACTIVE'
    });

    if (!activeSessions || activeSessions.length === 0) {
      return c.json({ success: true, token: null });
    }

    const activeSession = activeSessions[0];
    const plainToken = await bleTokenService.upsertTokenForStudent(activeSession.id, student.id);
    
    return c.json({ success: true, token: plainToken });
  } catch (error: any) {
    return handleStudentError(c, error);
  }
});

// --- BLE Devices Endpoints ---

studentRoutes.get('/:studentId/ble-devices', async (c) => {
  try {
    const { studentId } = c.req.param();
    const devices = await deviceRepo.findByStudentId(studentId);
    return c.json({ success: true, data: devices });
  } catch (error: any) {
    return handleStudentError(c, error);
  }
});

studentRoutes.post('/:studentId/ble-devices', async (c) => {
  try {
    const { studentId } = c.req.param();
    const body = await c.req.json();
    const device = await deviceRepo.create({
      studentId,
      deviceId: body.deviceId,
      deviceName: body.deviceName,
      bleIdentifier: body.bleIdentifier,
    });
    return c.json({ success: true, data: device }, 201);
  } catch (error: any) {
    return handleStudentError(c, error);
  }
});

studentRoutes.patch('/:studentId/ble-devices/:deviceId', async (c) => {
  try {
    const { deviceId } = c.req.param();
    const body = await c.req.json();
    const device = await deviceRepo.update(deviceId, body);
    return c.json({ success: true, data: device });
  } catch (error: any) {
    return handleStudentError(c, error);
  }
});

studentRoutes.delete('/:studentId/ble-devices/:deviceId', async (c) => {
  try {
    const { deviceId } = c.req.param();
    await deviceRepo.delete(deviceId);
    return c.json({ success: true, data: null });
  } catch (error: any) {
    return handleStudentError(c, error);
  }
});
