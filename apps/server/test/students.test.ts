import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { msAuthService } from '../src/services/ms-auth.service';
import { db } from '../src/db';
import { departments, academicYears, batches, regulations, classes } from '../src/db/schema/academic';
import { students } from '../src/db/schema/students';
import { attendanceSessions } from '../src/db/schema/attendance';
import { attendanceRecords } from '../src/db/schema/attendance-records';
import { timetables } from '../src/db/schema/timetable';
import { periods } from '../src/db/schema/timetable';
import { subjects } from '../src/db/schema/subjects';
import { auditLogs } from '../src/db/schema/audit';
import { staff, roles, staffRoles } from '../src/db/schema/staff';
import { eq, desc } from 'drizzle-orm';
import app from '../src/index';

describe('Phase W4 — Student Management & Bulk Import Integration Test Suite', () => {
  let adminToken: string;
  let hodToken: string;
  let staffToken: string;
  let itDepartmentId: string;
  let testClassId: string;
  let testClassName: string;
  let testStudentWithAttendanceId: string;

  let testAdminStaffId: string;
  let testHodStaffId: string;
  let testStaffMemberId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test_secret_for_vitest_runner_min_32_characters_long!';
    process.env.COLLEGE_EMAIL_DOMAIN = 'sonatech.ac.in';

    // 1. Ensure IT Department exists
    let dept = await db.select().from(departments).where(eq(departments.code, 'IT')).then(r => r[0]);
    if (!dept) {
      dept = await db.insert(departments).values({
        name: 'Information Technology',
        code: 'IT',
        status: 'ACTIVE',
      }).returning().then(r => r[0]);
    }
    itDepartmentId = dept.id;

    // 2. Ensure an active class exists
    let cls = await db.select().from(classes).limit(1).then(r => r[0]);
    if (!cls) {
      // Create dependencies
      const ay = await db.insert(academicYears).values({
        name: `AY-TEST-${Date.now()}`,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2027-05-31'),
        isCurrent: true,
      }).returning().then(r => r[0]);

      const batch = await db.insert(batches).values({
        name: `BATCH-TEST-${Date.now()}`,
        startYear: 2024,
        endYear: 2028,
        departmentId: itDepartmentId,
      }).returning().then(r => r[0]);

      const reg = await db.insert(regulations).values({
        name: `REG-TEST-${Date.now()}`,
        year: 2023,
      }).returning().then(r => r[0]);

      cls = await db.insert(classes).values({
        name: 'III IT-A',
        yearNumber: 3,
        section: 'A',
        departmentId: itDepartmentId,
        academicYearId: ay.id,
        batchId: batch.id,
        regulationId: reg.id,
      }).returning().then(r => r[0]);
    }
    testClassId = cls.id;
    testClassName = cls.name;

    // 3. Roles & test staff
    let rAdmin = await db.select().from(roles).where(eq(roles.name, 'ADMIN')).then(r => r[0]);
    if (!rAdmin) {
      rAdmin = await db.insert(roles).values({ name: 'ADMIN', description: 'System Administrator' }).returning().then(r => r[0]);
    }
    let rHod = await db.select().from(roles).where(eq(roles.name, 'HOD')).then(r => r[0]);
    if (!rHod) {
      rHod = await db.insert(roles).values({ name: 'HOD', description: 'Head of Department' }).returning().then(r => r[0]);
    }
    let rStaff = await db.select().from(roles).where(eq(roles.name, 'STAFF')).then(r => r[0]);
    if (!rStaff) {
      rStaff = await db.insert(roles).values({ name: 'STAFF', description: 'Faculty' }).returning().then(r => r[0]);
    }

    const sAdmin = await db.insert(staff).values({
      staffCode: `W4-ADM-${Date.now().toString().slice(-4)}`,
      name: 'Dr. Student Admin',
      collegeEmail: `w4.admin.${Date.now()}@sonatech.ac.in`,
      status: 'ACTIVE',
    }).returning().then(r => r[0]);
    testAdminStaffId = sAdmin.id;
    await db.insert(staffRoles).values({ staffId: testAdminStaffId, roleId: rAdmin.id });

    const sHod = await db.insert(staff).values({
      staffCode: `W4-HOD-${Date.now().toString().slice(-4)}`,
      name: 'Dr. Student HOD',
      collegeEmail: `w4.hod.${Date.now()}@sonatech.ac.in`,
      status: 'ACTIVE',
    }).returning().then(r => r[0]);
    testHodStaffId = sHod.id;
    await db.insert(staffRoles).values({ staffId: testHodStaffId, roleId: rHod.id });

    const sStaff = await db.insert(staff).values({
      staffCode: `W4-STF-${Date.now().toString().slice(-4)}`,
      name: 'Faculty Member',
      collegeEmail: `w4.faculty.${Date.now()}@sonatech.ac.in`,
      status: 'ACTIVE',
    }).returning().then(r => r[0]);
    testStaffMemberId = sStaff.id;
    await db.insert(staffRoles).values({ staffId: testStaffMemberId, roleId: rStaff.id });

    // Mint session tokens
    adminToken = await msAuthService.createSessionToken({
      id: testAdminStaffId,
      name: sAdmin.name,
      collegeEmail: sAdmin.collegeEmail,
      roles: ['ADMIN'],
      userType: 'STAFF',
    });

    hodToken = await msAuthService.createSessionToken({
      id: testHodStaffId,
      name: sHod.name,
      collegeEmail: sHod.collegeEmail,
      roles: ['HOD'],
      userType: 'STAFF',
    });

    staffToken = await msAuthService.createSessionToken({
      id: testStaffMemberId,
      name: sStaff.name,
      collegeEmail: sStaff.collegeEmail,
      roles: ['STAFF'],
      userType: 'STAFF',
    });

    // 4. Create a student with an attendance record for referential integrity testing
    const stAtt = await db.insert(students).values({
      registerNumber: `6178ATT${Date.now().toString().slice(-4)}`,
      name: 'Student With Attendance',
      collegeEmail: `att.student.${Date.now()}@sonatech.ac.in`,
      classId: testClassId,
      status: 'ACTIVE',
    }).returning().then(r => r[0]);
    testStudentWithAttendanceId = stAtt.id;

    // Check or create period, subject, timetable, and attendance session to link attendance record
    let tt = await db.select().from(timetables).limit(1).then(r => r[0]);
    if (tt) {
      let session = await db.select().from(attendanceSessions).where(eq(attendanceSessions.timetableId, tt.id)).limit(1).then(r => r[0]);
      if (!session) {
        session = await db.insert(attendanceSessions).values({
          timetableId: tt.id,
          sessionDate: '2026-10-18',
          status: 'COMPLETED',
          startedByStaffId: testAdminStaffId,
        }).returning().then(r => r[0]);
      }

      await db.insert(attendanceRecords).values({
        attendanceSessionId: session.id,
        studentId: testStudentWithAttendanceId,
        status: 'PRESENT',
        source: 'MANUAL',
        markedAt: new Date().toISOString(),
        markedBy: testAdminStaffId,
      });
    }
  });

  afterAll(async () => {
    // Clean up test attendance records and student
    if (testStudentWithAttendanceId) {
      await db.delete(attendanceRecords).where(eq(attendanceRecords.studentId, testStudentWithAttendanceId));
      await db.delete(students).where(eq(students.id, testStudentWithAttendanceId));
    }

    // Clean up test staff & audit logs
    if (testAdminStaffId) {
      await db.delete(attendanceSessions).where(eq(attendanceSessions.startedByStaffId, testAdminStaffId));
      await db.delete(auditLogs).where(eq(auditLogs.actorId, testAdminStaffId));
      await db.delete(staffRoles).where(eq(staffRoles.staffId, testAdminStaffId));
      await db.delete(staff).where(eq(staff.id, testAdminStaffId));
    }
    if (testHodStaffId) {
      await db.delete(auditLogs).where(eq(auditLogs.actorId, testHodStaffId));
      await db.delete(staffRoles).where(eq(staffRoles.staffId, testHodStaffId));
      await db.delete(staff).where(eq(staff.id, testHodStaffId));
    }
    if (testStaffMemberId) {
      await db.delete(auditLogs).where(eq(auditLogs.actorId, testStaffMemberId));
      await db.delete(staffRoles).where(eq(staffRoles.staffId, testStaffMemberId));
      await db.delete(staff).where(eq(staff.id, testStaffMemberId));
    }
  });

  // ==========================================
  // 1. RBAC & ENDPOINT AUTHORIZATION
  // ==========================================
  describe('1. RBAC & Endpoint Authorization', () => {
    it('should reject unauthenticated requests to /api/students with 401', async () => {
      const res = await app.request('/api/students');
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should allow STAFF role to read student records (GET /api/students)', async () => {
      const res = await app.request('/api/students', {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.students)).toBe(true);
      expect(body.data.pagination).toBeDefined();
    });

    it('should forbid STAFF role from creating a student (POST /api/students) with 403', async () => {
      const res = await app.request('/api/students', {
        method: 'POST',
        headers: { Authorization: `Bearer ${staffToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registerNumber: '61789999999999',
          name: 'Unauthorized Student',
          collegeEmail: 'unauthorized@sonatech.ac.in',
          classId: testClassId,
        }),
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('should forbid STAFF role from updating a student with 403', async () => {
      const res = await app.request(`/api/students/${testStudentWithAttendanceId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${staffToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Tampered Name' }),
      });
      expect(res.status).toBe(403);
    });

    it('should forbid STAFF role from deleting a student with 403', async () => {
      const res = await app.request(`/api/students/${testStudentWithAttendanceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('should forbid STAFF role from confirming bulk import with 403', async () => {
      const res = await app.request('/api/students/import/confirm', {
        method: 'POST',
        headers: { Authorization: `Bearer ${staffToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ importData: [] }),
      });
      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // 2. STUDENT VALIDATION & CRUD
  // ==========================================
  describe('2. Student CRUD & Field Validations', () => {
    let createdStudentId: string;
    const testRegNo = `6178${Date.now().toString().slice(-8)}`;
    const testEmail = `student.${Date.now()}@sonatech.ac.in`;

    it('should reject email from non-college domain with 400', async () => {
      const res = await app.request('/api/students', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registerNumber: `6178${Date.now().toString().slice(-8)}`,
          name: 'External Student',
          collegeEmail: 'external.student@gmail.com', // Forbidden domain!
          classId: testClassId,
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('sonatech.ac.in');
    });

    it('should reject invalid register number format with 400', async () => {
      const res = await app.request('/api/students', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registerNumber: '12', // Too short (< 5 chars)
          name: 'Short Reg Student',
          collegeEmail: `short.reg.${Date.now()}@sonatech.ac.in`,
          classId: testClassId,
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Register number must be 5 to 20 alphanumeric characters');
    });

    it('should reject missing or short student name with 400', async () => {
      const res = await app.request('/api/students', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registerNumber: `6178${Date.now().toString().slice(-8)}`,
          name: ' ', // Empty
          collegeEmail: `empty.name.${Date.now()}@sonatech.ac.in`,
          classId: testClassId,
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should create student successfully and record CREATE_STUDENT audit log', async () => {
      const res = await app.request('/api/students', {
        method: 'POST',
        headers: { Authorization: `Bearer ${hodToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registerNumber: testRegNo,
          name: 'Karthik Subramanian',
          collegeEmail: testEmail,
          classId: testClassId,
          status: 'ACTIVE',
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.registerNumber).toBe(testRegNo.toUpperCase());
      expect(body.data.collegeEmail).toBe(testEmail.toLowerCase());
      createdStudentId = body.data.id;

      // Verify audit log
      const log = await db.select().from(auditLogs)
        .where(eq(auditLogs.entityId, createdStudentId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(1)
        .then(r => r[0]);
      expect(log).toBeDefined();
      expect(log.action).toBe('CREATE_STUDENT');
      expect(log.actorRole).toBe('HOD');
    });

    it('should reject duplicate register number with 409 Conflict', async () => {
      const res = await app.request('/api/students', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registerNumber: testRegNo, // Duplicate!
          name: 'Another Name',
          collegeEmail: `another.${Date.now()}@sonatech.ac.in`,
          classId: testClassId,
        }),
      });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe('CONFLICT');
      expect(body.error.message).toContain('already exists');
    });

    it('should reject duplicate college email with 409 Conflict', async () => {
      const res = await app.request('/api/students', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registerNumber: `6178${Date.now().toString().slice(-8)}`,
          name: 'Duplicate Email Student',
          collegeEmail: testEmail, // Duplicate!
          classId: testClassId,
        }),
      });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe('CONFLICT');
      expect(body.error.message).toContain('already exists');
    });

    it('should update student and record UPDATE_STUDENT audit log', async () => {
      const res = await app.request(`/api/students/${createdStudentId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Karthik Subramanian Updated',
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.name).toBe('Karthik Subramanian Updated');

      const log = await db.select().from(auditLogs)
        .where(eq(auditLogs.entityId, createdStudentId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(1)
        .then(r => r[0]);
      expect(log).toBeDefined();
      expect(log.action).toBe('UPDATE_STUDENT');
    });

    it('should update student status via PATCH /:id/status and record audit log', async () => {
      const res = await app.request(`/api/students/${createdStudentId}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SUSPENDED' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.status).toBe('SUSPENDED');

      const log = await db.select().from(auditLogs)
        .where(eq(auditLogs.entityId, createdStudentId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(1)
        .then(r => r[0]);
      expect(log).toBeDefined();
      expect(log.action).toBe('UPDATE_STUDENT_STATUS');
    });

    it('should prevent deletion of student with attendance records (409 Conflict)', async () => {
      const res = await app.request(`/api/students/${testStudentWithAttendanceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe('CONFLICT');
      expect(body.error.message).toContain('attendance record');
    });

    it('should safely delete unreferenced student and record DELETE_STUDENT audit log', async () => {
      const res = await app.request(`/api/students/${createdStudentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);

      const log = await db.select().from(auditLogs)
        .where(eq(auditLogs.entityId, createdStudentId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(1)
        .then(r => r[0]);
      expect(log).toBeDefined();
      expect(log.action).toBe('DELETE_STUDENT');
    });
  });

  // ==========================================
  // 3. BULK IMPORT & TEMPLATES
  // ==========================================
  describe('3. Bulk Import & Templates', () => {
    it('should download CSV template with sonatech.ac.in domain', async () => {
      const res = await app.request('/api/students/template/csv', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      const text = await res.text();
      expect(text).toContain('register_number,name,college_email,class');
      expect(text).toContain('@sonatech.ac.in');
    });

    it('should download Excel template successfully', async () => {
      const res = await app.request('/api/students/template/xlsx', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('spreadsheetml');
    });

    it('should reject bulk import validate if no file uploaded', async () => {
      const formData = new FormData();
      const res = await app.request('/api/students/import/validate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: formData,
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate CSV file and report valid and invalid rows correctly', async () => {
      const uniqueSuffix = Date.now().toString().slice(-4);
      const validReg = `6178VAL${uniqueSuffix}`;
      const validEmail = `valid.${uniqueSuffix}@sonatech.ac.in`;
      
      const csvContent = [
        'register_number,name,college_email,class',
        `${validReg},Valid Student,${validEmail},${testClassName}`,
        `6178BAD1${uniqueSuffix},Invalid Domain Student,bad@gmail.com,${testClassName}`, // Bad domain
        `123,Short Reg Student,short.${uniqueSuffix}@sonatech.ac.in,${testClassName}`, // Bad reg number
        `6178BAD2${uniqueSuffix},Nonexistent Class Student,noclass.${uniqueSuffix}@sonatech.ac.in,NONEXISTENT_CLASS_999`, // Bad class
      ].join('\n');

      const formData = new FormData();
      const blob = new Blob([csvContent], { type: 'text/csv' });
      formData.append('file', blob, 'students_test.csv');

      const res = await app.request('/api/students/import/validate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: formData,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.totalRows).toBe(4);
      expect(body.data.valid).toBe(1);
      expect(body.data.errors).toBe(3);

      const rows = body.data.data;
      expect(rows[0].isValid).toBe(true);
      expect(rows[0].classId).toBe(testClassId);

      // Verify row 1 error (invalid domain)
      expect(rows[1].isValid).toBe(false);
      expect(rows[1].errors.some((e: any) => e.code === 'INVALID_DOMAIN')).toBe(true);

      // Verify row 2 error (invalid register number)
      expect(rows[2].isValid).toBe(false);
      expect(rows[2].errors.some((e: any) => e.code === 'INVALID_REGISTER_NUMBER')).toBe(true);

      // Verify row 3 error (class not found)
      expect(rows[3].isValid).toBe(false);
      expect(rows[3].errors.some((e: any) => e.code === 'CLASS_NOT_FOUND')).toBe(true);
    });

    it('should reject confirmImport if any row has errors', async () => {
      const res = await app.request('/api/students/import/confirm', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importData: [
            { registerNumber: '6178OK', name: 'OK', collegeEmail: 'ok@sonatech.ac.in', classId: testClassId, isValid: true },
            { registerNumber: '6178ERR', name: 'ERR', collegeEmail: 'err@gmail.com', classId: null, isValid: false },
          ],
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Cannot import file with errors');
    });

    it('should successfully confirm valid import transactionally and write BULK_IMPORT_STUDENTS audit log', async () => {
      const uniqueSuffix = Date.now().toString().slice(-4);
      const s1Reg = `6178IMP1${uniqueSuffix}`;
      const s1Email = `imp1.${uniqueSuffix}@sonatech.ac.in`;
      const s2Reg = `6178IMP2${uniqueSuffix}`;
      const s2Email = `imp2.${uniqueSuffix}@sonatech.ac.in`;

      const validRows = [
        {
          registerNumber: s1Reg,
          name: 'Bulk Imported Student One',
          collegeEmail: s1Email,
          className: testClassName,
          classId: testClassId,
          isValid: true,
        },
        {
          registerNumber: s2Reg,
          name: 'Bulk Imported Student Two',
          collegeEmail: s2Email,
          className: testClassName,
          classId: testClassId,
          isValid: true,
        },
      ];

      const res = await app.request('/api/students/import/confirm', {
        method: 'POST',
        headers: { Authorization: `Bearer ${hodToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ importData: validRows }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.total).toBe(2);
      expect(body.data.created).toBe(2);

      // Verify that students exist in DB
      const dbS1 = await db.select().from(students).where(eq(students.registerNumber, s1Reg)).then(r => r[0]);
      expect(dbS1).toBeDefined();
      expect(dbS1.collegeEmail).toBe(s1Email);

      const dbS2 = await db.select().from(students).where(eq(students.registerNumber, s2Reg)).then(r => r[0]);
      expect(dbS2).toBeDefined();
      expect(dbS2.collegeEmail).toBe(s2Email);

      // Verify audit log
      const log = await db.select().from(auditLogs)
        .where(eq(auditLogs.action, 'BULK_IMPORT_STUDENTS'))
        .orderBy(desc(auditLogs.createdAt))
        .limit(1)
        .then(r => r[0]);
      expect(log).toBeDefined();
      expect(log.actorRole).toBe('HOD');

      // Clean up test students
      await db.delete(students).where(eq(students.id, dbS1.id));
      await db.delete(students).where(eq(students.id, dbS2.id));
    });
  });
});
