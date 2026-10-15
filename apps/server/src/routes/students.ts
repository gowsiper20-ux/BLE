import { Hono } from "hono";
import { StudentService } from "../services/student.service";
import { AttendanceSessionService } from "../services/attendance-session.service";
import { requireStudentAuth } from "../middlewares/auth.middleware";
import * as xlsx from 'xlsx';

export const studentRoutes = new Hono<{ Variables: { student: any } }>();
const service = new StudentService();
const attendanceService = new AttendanceSessionService();

import { BleTokenService } from "../services/ble-token.service";
const bleTokenService = new BleTokenService();

studentRoutes.get("/", async (c) => {
  try {
    const search = c.req.query("search");
    const classId = c.req.query("classId");
    const status = c.req.query("status");
    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = parseInt(c.req.query("limit") || "20", 10);

    const data = await service.getStudents({ search, classId, status, page, limit });
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

// GET /api/students/me/attendance/current
studentRoutes.get("/me/attendance/current", requireStudentAuth, async (c) => {
  try {
    const student = c.get('student');
    
    if (!student.classId) {
      return c.json({ success: true, session: null });
    }

    // Find active session for the student's class for today
    const today = new Date().toISOString().split('T')[0];
    
    // We get all sessions that match the classId, date, and status
    const activeSessions = await attendanceService.getSessions({
      classId: student.classId,
      date: today,
      status: 'ACTIVE'
    });

    if (activeSessions && activeSessions.length > 0) {
      // Assuming only one active session per class at a time
      return c.json({ success: true, session: activeSessions[0] });
    }

    return c.json({ success: true, session: null });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

// GET /api/students/me/attendance/ble-token
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
    
    // Generate/Rotate token for the student
    const plainToken = await bleTokenService.upsertTokenForStudent(activeSession.id, student.id);
    
    return c.json({ success: true, token: plainToken });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

studentRoutes.get("/:id", async (c) => {
  try {
    const data = await service.getStudentById(c.req.param("id"));
    if (!data) return c.json({ success: false, error: { message: "Not found" } }, 404);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

studentRoutes.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.createStudent(body);
    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      return c.json({ success: false, error: { code: 'CONFLICT', message: error.message } }, 409);
    }
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.message } }, 400);
  }
});

studentRoutes.patch("/:id", async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.updateStudent(c.req.param("id"), body);
    return c.json({ success: true, data });
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      return c.json({ success: false, error: { code: 'CONFLICT', message: error.message } }, 409);
    }
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.message } }, 400);
  }
});

studentRoutes.patch("/:id/status", async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.updateStudentStatus(c.req.param("id"), body.status);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

studentRoutes.delete("/:id", async (c) => {
  try {
    // For this MVP, DELETE actually maps to deactivating the student
    await service.updateStudentStatus(c.req.param("id"), 'INACTIVE');
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

// --- Bulk Import ---

studentRoutes.post("/import/validate", async (c) => {
  try {
    const formData = await c.req.parseBody();
    const file = formData['file'] as File;

    if (!file) {
      return c.json({ success: false, error: { message: 'No file uploaded.' } }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const preview = await service.validateImportFile(buffer, file.name, file.type);
    
    return c.json({ success: true, data: preview });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

studentRoutes.post("/import/confirm", async (c) => {
  try {
    const body = await c.req.json();
    const result = await service.confirmImport(body.importData);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

studentRoutes.get("/template/csv", async (c) => {
  const csvContent = 'register_number,name,college_email,class\n61782324106032,Harinarayanan,harinarayanan.24it@college.edu,II IT-A';
  c.header('Content-Type', 'text/csv');
  c.header('Content-Disposition', 'attachment; filename="students_template.csv"');
  return c.body(csvContent);
});

studentRoutes.get("/template/xlsx", async (c) => {
  const worksheet = xlsx.utils.json_to_sheet([
    {
      register_number: '61782324106032',
      name: 'Harinarayanan',
      college_email: 'harinarayanan.24it@college.edu',
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

import { StudentBleDeviceRepository } from '../repositories/student-ble-device.repository';
const deviceRepo = new StudentBleDeviceRepository();

studentRoutes.get('/:studentId/ble-devices', async (c) => {
  try {
    const { studentId } = c.req.param();
    const devices = await deviceRepo.findByStudentId(studentId);
    return c.json({ success: true, data: devices });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
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
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

studentRoutes.patch('/:studentId/ble-devices/:deviceId', async (c) => {
  try {
    const { deviceId } = c.req.param();
    const body = await c.req.json();
    const device = await deviceRepo.update(deviceId, body);
    return c.json({ success: true, data: device });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

studentRoutes.delete('/:studentId/ble-devices/:deviceId', async (c) => {
  try {
    const { deviceId } = c.req.param();
    await deviceRepo.delete(deviceId);
    return c.json({ success: true, data: null });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});
