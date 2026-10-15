import 'dotenv/config';
import { db } from '../src/db';
import { sql, ilike, or, inArray } from 'drizzle-orm';
import { students } from '../src/db/schema/students';
import { classes, batches, regulations, academicYears, departments } from '../src/db/schema/academic';
import { attendanceRecords } from '../src/db/schema/attendance-records';
import { attendanceBleTokens } from '../src/db/schema/attendance-ble-tokens';
import { studentBleDevices } from '../src/db/schema/student-ble-devices';
import { timetable, periods, rooms } from '../src/db/schema/timetable';
import { staff, classCounselors } from '../src/db/schema/staff';

async function clearJunk() {
  const suffixes = ['%m79j%', '%lnjlv%', '%lnjIv%'];

  const buildOr = (column: any) => or(...suffixes.map(s => ilike(column, s)));

  console.log('Cleaning junk data...');

  // Ble devices and attendance records depending on students
  const badStudents = await db.select({ id: students.id }).from(students).where(buildOr(students.registerNumber));
  
  if (badStudents.length > 0) {
    const badIds = badStudents.map(s => s.id);
    await db.delete(attendanceRecords).where(inArray(attendanceRecords.studentId, badIds));
    await db.delete(studentBleDevices).where(inArray(studentBleDevices.studentId, badIds));
  }

  // Students
  const resStudents = await db.delete(students).where(buildOr(students.registerNumber)).returning({ id: students.id, num: students.registerNumber });
  console.log('Deleted students:', resStudents);

  // Classes
  const resClasses = await db.delete(classes).where(buildOr(classes.name)).returning({ name: classes.name });
  console.log('Deleted classes:', resClasses);

  // Batches
  const resBatches = await db.delete(batches).where(buildOr(batches.name)).returning({ name: batches.name });
  console.log('Deleted batches:', resBatches);

  // Regulations
  const resRegs = await db.delete(regulations).where(buildOr(regulations.name)).returning({ name: regulations.name });
  console.log('Deleted regulations:', resRegs);

  // Academic Years
  const resYears = await db.delete(academicYears).where(buildOr(academicYears.name)).returning({ name: academicYears.name });
  console.log('Deleted academic years:', resYears);

  // Departments
  const resDepts = await db.delete(departments).where(buildOr(departments.code)).returning({ code: departments.code });
  console.log('Deleted departments:', resDepts);
  
  // Also clean up duplicate academic year 2026-2027 if any.
  // We can leave it for manual if needed.

  console.log('Done!');
  process.exit(0);
}

clearJunk().catch(e => {
  console.error(e);
  process.exit(1);
});
