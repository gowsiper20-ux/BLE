import 'dotenv/config';
import { db } from '../src/db';
import { classes, academicYears, departments, regulations, batches } from '../src/db/schema/academic';
import { students } from '../src/db/schema/students';
import { staff } from '../src/db/schema/staff';
import { subjects } from '../src/db/schema/subjects';
import { timetables, periods, rooms } from '../src/db/schema/timetable';
import { attendanceSessions } from '../src/db/schema/attendance';
import { attendanceRecords } from '../src/db/schema/attendance-records';
import { attendanceBleTokens } from '../src/db/schema/attendance-ble-tokens';

import { BleAttendanceService } from '../src/services/ble-attendance.service';

const bleService = new BleAttendanceService();

async function runTests() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('BLE test fixtures require a dedicated test database.');
  const databaseTarget = new URL(databaseUrl);
  const databaseName = decodeURIComponent(databaseTarget.pathname.replace(/^\//, ''));
  if (
    process.env.NODE_ENV !== 'test' ||
    !['localhost', '127.0.0.1', '::1'].includes(databaseTarget.hostname) ||
    !databaseName.endsWith('_test')
  ) {
    throw new Error('Refusing BLE test fixtures: use NODE_ENV=test and a loopback database ending in _test.');
  }

  console.log("Starting BLE Attendance Tests...");

  // Setup Test Data
  const suffix = Math.random().toString(36).substring(7);

  console.log("Setup year");
  const [academicYear] = await db.insert(academicYears).values({ name: `2026-2027-${suffix}`, startDate: new Date('2026-06-01'), endDate: new Date('2027-05-31'), isCurrent: true }).returning();
  console.log("Setup dept");
  const [department] = await db.insert(departments).values({ name: `IT-${suffix}`, code: `IT-${suffix}` }).returning();
  console.log("Setup reg");
  const [regulation] = await db.insert(regulations).values({ name: `R2026-${suffix}`, year: 2026 }).returning();
  const [batch] = await db.insert(batches).values({ name: `2024-2028-${suffix}`, startYear: 2024, endYear: 2028, departmentId: department.id }).returning();
  
  console.log("Setup class");
  const [classA] = await db.insert(classes).values({ name: `II IT-A-${suffix}`, yearNumber: 2, section: 'A', departmentId: department.id, academicYearId: academicYear.id, regulationId: regulation.id, batchId: batch.id }).returning();
  const [classB] = await db.insert(classes).values({ name: `II IT-B-${suffix}`, yearNumber: 2, section: 'B', departmentId: department.id, academicYearId: academicYear.id, regulationId: regulation.id, batchId: batch.id }).returning();

  const [studentA] = await db.insert(students).values({ registerNumber: `TEST_A_${suffix}`, name: 'Student A', collegeEmail: `a_${suffix}@test.com`, classId: classA.id, status: 'ACTIVE' }).returning();
  const [studentB] = await db.insert(students).values({ registerNumber: `TEST_B_${suffix}`, name: 'Student B', collegeEmail: `b_${suffix}@test.com`, classId: classA.id, status: 'ACTIVE' }).returning();
  const [studentC] = await db.insert(students).values({ registerNumber: `TEST_C_${suffix}`, name: 'Student C', collegeEmail: `c_${suffix}@test.com`, classId: classB.id, status: 'ACTIVE' }).returning();
  const [studentInac] = await db.insert(students).values({ registerNumber: `TEST_INAC_${suffix}`, name: 'Student Inac', collegeEmail: `inac_${suffix}@test.com`, classId: classA.id, status: 'INACTIVE' }).returning();

  const [testStaff] = await db.insert(staff).values({ staffId: `STF_TEST_${suffix}`, name: 'Prof. Test', email: `prof_${suffix}@test.com`, department: 'IT', role: 'STAFF', isActive: true }).returning();
  const [subject] = await db.insert(subjects).values({ code: `CS_TEST_${suffix}`, name: 'DBMS', shortName: 'DBMS', credits: 3, type: 'THEORY', regulationId: regulation.id, semester: 3, department: 'IT' }).returning();
  const [period] = await db.insert(periods).values({ periodNumber: 1, name: 'P1', startTime: '09:00', endTime: '09:50' }).returning();
  const [room] = await db.insert(rooms).values({ name: `L101_${suffix}` }).returning();

  const [timetable] = await db.insert(timetables).values({ academicYearId: academicYear.id, classId: classA.id, dayOfWeek: 'MONDAY', periodId: period.id, subjectId: subject.id, staffId: testStaff.id, roomId: room.id }).returning();

  console.log("Setup session");
  const sessionDate = new Date().toISOString().split('T')[0];
  const [session] = await db.insert(attendanceSessions).values({
    timetableId: timetable.id,
    sessionDate,
    status: 'ACTIVE',
    startedAt: new Date().toISOString(),
    startedByStaffId: testStaff.id
  }).returning();

  console.log("1. Starting BLE Session...");
  const startResult = await bleService.startBleSession(session.id);
  console.assert(startResult.success === true, "BLE Start failed");
  const tokens = startResult.tokens as any[];
  console.log(`Issued ${tokens.length} tokens. (Expected 2 - A and B)`);
  console.assert(tokens.length === 2, "Should only issue tokens for active students in class A");

  const tokenA = tokens.find(t => t.studentId === studentA.id)?.token;
  const tokenB = tokens.find(t => t.studentId === studentB.id)?.token;

  console.log("2. Valid BLE Detection (Student A)...");
  const det1 = await bleService.processDetections(session.id, [{ token: tokenA, rssi: -50, detectedAt: new Date().toISOString() }]);
  console.assert(det1.accepted === 1, "Student A should be accepted");

  console.log("3. Duplicate BLE Detection (Student A)...");
  const det2 = await bleService.processDetections(session.id, [{ token: tokenA, rssi: -45, detectedAt: new Date().toISOString() }]);
  console.assert(det2.duplicates === 1, "Student A second detection should be duplicate");

  console.log("4. Invalid Token...");
  const det3 = await bleService.processDetections(session.id, [{ token: "FAKE_TOKEN_123", rssi: -50, detectedAt: new Date().toISOString() }]);
  console.assert(det3.rejected === 1, "Fake token should be rejected");

  console.log("5. Live Attendance Statistics...");
  const live = await bleService.getLiveAttendance(session.id);
  console.assert(live.totalStudents === 2, "Total students should be 2");
  console.assert(live.detectedStudents === 1, "Detected should be 1");
  console.assert(live.percentage === 50, "Percentage should be 50");
  
  const rosterA = live.students.find((s: any) => s.studentId === studentA.id);
  const rosterB = live.students.find((s: any) => s.studentId === studentB.id);
  console.assert(rosterA.status === 'PRESENT', "A should be PRESENT");
  console.assert(rosterB.status === 'NOT DETECTED', "B should be NOT DETECTED");

  console.log("6. BLE Stop...");
  const stopResult = await bleService.stopBleSession(session.id);
  console.assert(stopResult.success === true, "BLE Stop failed");

  console.log("7. Detection with expired token...");
  const det4 = await bleService.processDetections(session.id, [{ token: tokenB, rssi: -50, detectedAt: new Date().toISOString() }]);
  console.assert(det4.rejected === 1, "Token should be expired after stop");

  console.log("All tests passed successfully!");
  process.exit(0);
}

runTests().catch(console.error);
