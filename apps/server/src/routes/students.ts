import { Hono } from "hono";
import { StudentService } from "../services/student.service";
import { AttendanceSessionService } from "../services/attendance-session.service";
import { requireStudentAuth, requireRole, requireHodOrAdmin, requireStaffOrAdmin } from "../middlewares/auth.middleware";
import { BleTokenService } from "../services/ble-token.service";
import { StudentBleDeviceRepository } from '../repositories/student-ble-device.repository';
import * as xlsx from 'xlsx';

export const studentRoutes = new Hono<{ Variables: { student: any } }>();
const service = new StudentService();
const attendanceService = new AttendanceSessionService();
const bleTokenService = new BleTokenService();
const deviceRepo = new StudentBleDeviceRepository();

function getActorFromContext(c: any) {
  const user = c.get('user');
  return {
    actorId: user?.id,
    actorName: user?.name || user?.email || 'System User',
    actorRole: user?.roles?.[0] || 'ADMIN',
    ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || '127.0.0.1',
    userAgent: c.req.header('user-agent'),
  };
}

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

// --- Student CRUD ---

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

studentRoutes.post("/", requireRole('ADMIN', 'HOD', 'DEPUTY_HOD'), async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.createStudent(body, getActorFromContext(c));
    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    return handleStudentError(c, error);
  }
});

studentRoutes.patch("/:id", requireRole('ADMIN', 'HOD', 'DEPUTY_HOD'), async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.updateStudent(c.req.param("id")!, body, getActorFromContext(c));
    return c.json({ success: true, data });
  } catch (error: any) {
    return handleStudentError(c, error);
  }
});

studentRoutes.patch("/:id/status", requireRole('ADMIN', 'HOD', 'DEPUTY_HOD'), async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.updateStudentStatus(c.req.param("id")!, body.status, getActorFromContext(c));
    return c.json({ success: true, data });
  } catch (error: any) {
    return handleStudentError(c, error);
  }
});

studentRoutes.delete("/:id", requireHodOrAdmin, async (c) => {
  try {
    const softParam = c.req.query("soft");
    if (softParam === 'true') {
      await service.updateStudentStatus(c.req.param("id")!, 'INACTIVE', getActorFromContext(c));
    } else {
      await service.deleteStudent(c.req.param("id")!, getActorFromContext(c));
    }
    return c.json({ success: true });
  } catch (error: any) {
    return handleStudentError(c, error);
  }
});

// --- Bulk Import ---

studentRoutes.post("/import/validate", requireHodOrAdmin, async (c) => {
  try {
    const formData = await c.req.parseBody();
    const file = formData['file'] as File;

    if (!file) {
      return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No file uploaded.' } }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const preview = await service.validateImportFile(buffer, file.name, file.type);
    
    return c.json({ success: true, data: preview });
  } catch (error: any) {
    return handleStudentError(c, error);
  }
});

studentRoutes.post("/import/confirm", requireHodOrAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const result = await service.confirmImport(body.importData, getActorFromContext(c));
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return handleStudentError(c, error);
  }
});

studentRoutes.get("/template/csv", requireStaffOrAdmin, async (c) => {
  const csvContent = 'register_number,name,college_email,class\n61782324106032,Harinarayanan S,61782324106032@sonatech.ac.in,II IT-A';
  c.header('Content-Type', 'text/csv');
  c.header('Content-Disposition', 'attachment; filename="students_template.csv"');
  return c.body(csvContent);
});

studentRoutes.get("/template/xlsx", requireStaffOrAdmin, async (c) => {
  const worksheet = xlsx.utils.json_to_sheet([
    {
      register_number: '61782324106032',
      name: 'Harinarayanan S',
      college_email: '61782324106032@sonatech.ac.in',
      class: 'II IT-A'
    }
  ]);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Template');
  const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  
  c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  c.header('Content-Disposition', 'attachment; filename="students_template.xlsx"');
  return c.body(buffer);
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
