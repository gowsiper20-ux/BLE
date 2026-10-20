import { Hono } from "hono";
import { StudentService } from "../services/student.service";
import { AttendanceSessionService } from "../services/attendance-session.service";
import { requireSharedModuleAccess, requireStudentAuth, requireStaffOrAdmin } from "../middlewares/auth.middleware";
import { BleTokenService } from "../services/ble-token.service";
import { StudentBleDeviceRepository } from '../repositories/student-ble-device.repository';
import type { students } from '../db/schema/students';
import { TabularImportError } from '../services/tabular-import';
import { getDateInTimeZone } from '../utils/date';

export const studentRoutes = new Hono<{ Variables: { student: any } }>();
const service = new StudentService();
const attendanceService = new AttendanceSessionService();
const bleTokenService = new BleTokenService();
const deviceRepo = new StudentBleDeviceRepository();

function handleStudentError(c: any, error: any) {
  const msg = error?.message || 'An unexpected error occurred.';
  if (error instanceof TabularImportError) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: msg } }, 400);
  }
  if (error?.code === '23505') {
    return c.json({ success: false, error: { code: 'CONFLICT', message: 'A student with this register number or email already exists.' } }, 409);
  }
  if (error?.code === '23503') {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'The selected class is no longer available.' } }, 400);
  }
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
    msg.includes('active or does not exist') ||
    msg.includes('errors') ||
    msg.includes('Cannot import') ||
    msg.includes('No data provided')
  ) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: msg } }, 400);
  }
  return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Unable to complete the student request. Please retry.' } }, 500);
}

function getActor(c: any) {
  const user = c.get('user');
  return {
    actorId: user?.roles.includes('FACULTY') ? undefined : user?.id,
    actorName: user?.name,
    actorRole: user?.roles?.[0],
    ipAddress: c.req.header('x-forwarded-for')?.split(',')[0]?.trim(),
    userAgent: c.req.header('user-agent'),
  };
}

async function getImportFile(c: any): Promise<{ file: File; buffer: Buffer } | Response> {
  const contentLength = Number(c.req.header('content-length'));
  if (Number.isFinite(contentLength) && contentLength > 5 * 1024 * 1024 + 64 * 1024) {
    return c.json({ success: false, error: { code: 'FILE_TOO_LARGE', message: 'Import files are limited to 5 MB.' } }, 413);
  }
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Choose a CSV or XLSX file.' } }, 400);
  }
  if (file.size > 5 * 1024 * 1024) {
    return c.json({ success: false, error: { code: 'FILE_TOO_LARGE', message: 'Import files are limited to 5 MB.' } }, 413);
  }
  const extension = file.name.toLowerCase().split('.').pop();
  const allowedTypes = extension === 'csv'
    ? ['text/csv', 'application/vnd.ms-excel', 'application/octet-stream', '']
    : extension === 'xlsx'
      ? ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream', '']
      : [];
  if (!allowedTypes.includes(file.type.toLowerCase())) {
    return c.json({ success: false, error: { code: 'UNSUPPORTED_FILE', message: 'Upload a valid .csv or .xlsx file.' } }, 400);
  }
  return { file, buffer: Buffer.from(await file.arrayBuffer()) };
}

studentRoutes.get('/import/template', requireSharedModuleAccess, (c) => {
  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', 'attachment; filename="student-import-template.csv"');
  return c.body('register_number,name,college_email,class_id\r\n');
});

studentRoutes.post('/import/preview', requireSharedModuleAccess, async (c) => {
  try {
    const upload = await getImportFile(c);
    if (upload instanceof Response) return upload;
    const data = await service.validateImportFile(upload.buffer, upload.file.name, upload.file.type);
    return c.json({ success: true, data });
  } catch (error: unknown) {
    return handleStudentError(c, error);
  }
});

studentRoutes.post('/import/confirm', requireSharedModuleAccess, async (c) => {
  try {
    const upload = await getImportFile(c);
    if (upload instanceof Response) return upload;
    const data = await service.confirmImport(upload.buffer, upload.file.name, upload.file.type, getActor(c));
    return c.json({ success: true, data });
  } catch (error: unknown) {
    return handleStudentError(c, error);
  }
});

studentRoutes.post('/', requireSharedModuleAccess, async (c) => {
  try {
    const body = await c.req.json() as Record<string, unknown>;
    if (
      typeof body.registerNumber !== 'string' ||
      typeof body.name !== 'string' ||
      typeof body.collegeEmail !== 'string' ||
      typeof body.classId !== 'string'
    ) {
      return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Register number, name, college email, and class are required.' } }, 400);
    }
    const student = await service.createStudent({
      registerNumber: body.registerNumber,
      name: body.name,
      collegeEmail: body.collegeEmail,
      classId: body.classId,
      status: 'ACTIVE',
    }, getActor(c));
    return c.json({ success: true, data: student }, 201);
  } catch (error: unknown) {
    return handleStudentError(c, error);
  }
});

studentRoutes.put('/:id', requireSharedModuleAccess, async (c) => {
  try {
    const body = await c.req.json() as Record<string, unknown>;
    const update: Partial<typeof students.$inferInsert> = {};
    for (const field of ['registerNumber', 'name', 'collegeEmail', 'classId'] as const) {
      if (body[field] !== undefined) {
        if (typeof body[field] !== 'string') {
          return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: `${field} must be a string.` } }, 400);
        }
        update[field] = body[field];
      }
    }
    if (!Object.keys(update).length) {
      return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Provide at least one permitted field to update.' } }, 400);
    }
    const data = await service.updateStudent(c.req.param('id')!, update, getActor(c));
    return c.json({ success: true, data });
  } catch (error: unknown) {
    return handleStudentError(c, error);
  }
});

studentRoutes.patch('/:id/status', requireSharedModuleAccess, async (c) => {
  try {
    const body = await c.req.json() as { status?: string };
    if (!['ACTIVE', 'INACTIVE', 'GRADUATED', 'SUSPENDED'].includes(body.status || '')) {
      return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Choose a supported student status.' } }, 400);
    }
    const data = await service.updateStudentStatus(
      c.req.param('id')!,
      body.status as 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'SUSPENDED',
      getActor(c),
    );
    return c.json({ success: true, data });
  } catch (error: unknown) {
    return handleStudentError(c, error);
  }
});

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

    const today = getDateInTimeZone();
    
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

    const today = getDateInTimeZone();
    
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

studentRoutes.get('/:studentId/ble-devices', requireStudentAuth, async (c) => {
  try {
    const { studentId } = c.req.param();
    if (c.get('user').id !== studentId) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'You may only view your own devices.' } }, 403);
    const devices = await deviceRepo.findByStudentId(studentId);
    return c.json({ success: true, data: devices });
  } catch (error: any) {
    return handleStudentError(c, error);
  }
});

studentRoutes.post('/:studentId/ble-devices', requireStudentAuth, async (c) => {
  try {
    const { studentId } = c.req.param();
    if (c.get('user').id !== studentId) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'You may only manage your own devices.' } }, 403);
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

studentRoutes.patch('/:studentId/ble-devices/:deviceId', requireStudentAuth, async (c) => {
  try {
    const { studentId, deviceId } = c.req.param();
    if (c.get('user').id !== studentId) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'You may only manage your own devices.' } }, 403);
    const body = await c.req.json();
    const device = await deviceRepo.update(deviceId, body);
    return c.json({ success: true, data: device });
  } catch (error: any) {
    return handleStudentError(c, error);
  }
});

studentRoutes.delete('/:studentId/ble-devices/:deviceId', requireStudentAuth, async (c) => {
  try {
    const { studentId, deviceId } = c.req.param();
    if (c.get('user').id !== studentId) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'You may only manage your own devices.' } }, 403);
    await deviceRepo.delete(deviceId);
    return c.json({ success: true, data: null });
  } catch (error: any) {
    return handleStudentError(c, error);
  }
});
