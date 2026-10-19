import { eq, ilike, and, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { students } from '../db/schema/students';
import { classes, batches, academicYears, departments, regulations } from '../db/schema/academic';
import { attendanceRecords } from '../db/schema/attendance-records';
import { externalIdentities } from '../db/schema/auth';
import { studentBleDevices } from '../db/schema/student-ble-devices';
import { attendanceBleTokens } from '../db/schema/attendance-ble-tokens';

export class StudentRepository {
  async getStudents(filters: {
    search?: string;
    classId?: string;
    departmentId?: string;
    batchId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (filters.search) {
      const q = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          ilike(students.name, q),
          ilike(students.registerNumber, q),
          ilike(students.collegeEmail, q)
        )
      );
    }
    
    if (filters.classId) {
      conditions.push(eq(students.classId, filters.classId));
    }

    if (filters.departmentId) {
      conditions.push(eq(classes.departmentId, filters.departmentId));
    }

    if (filters.batchId) {
      conditions.push(eq(classes.batchId, filters.batchId));
    }

    if (filters.status) {
      conditions.push(eq(students.status, filters.status as any));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const query = db
      .select({
        id: students.id,
        registerNumber: students.registerNumber,
        name: students.name,
        collegeEmail: students.collegeEmail,
        microsoftUserId: students.microsoftUserId,
        status: students.status,
        className: classes.name,
        classId: classes.id,
        batchName: batches.name,
        departmentCode: departments.code,
        academicYearName: academicYears.name,
        regulationName: regulations.name,
        createdAt: students.createdAt,
      })
      .from(students)
      .leftJoin(classes, eq(students.classId, classes.id))
      .leftJoin(batches, eq(classes.batchId, batches.id))
      .leftJoin(departments, eq(classes.departmentId, departments.id))
      .leftJoin(academicYears, eq(classes.academicYearId, academicYears.id))
      .leftJoin(regulations, eq(classes.regulationId, regulations.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(students.registerNumber);

    const countQuery = db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(students)
      .leftJoin(classes, eq(students.classId, classes.id))
      .where(whereClause);

    const [data, countResult] = await Promise.all([query, countQuery]);
    const total = Number(countResult[0]?.count || 0);

    return {
      students: data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      }
    };
  }

  async getStudentById(id: string) {
    const result = await db.select({
      id: students.id,
      registerNumber: students.registerNumber,
      name: students.name,
      collegeEmail: students.collegeEmail,
      microsoftUserId: students.microsoftUserId,
      status: students.status,
      className: classes.name,
      classId: classes.id,
      batchName: batches.name,
      departmentCode: departments.code,
      academicYearName: academicYears.name,
      regulationName: regulations.name,
      createdAt: students.createdAt,
      updatedAt: students.updatedAt,
    })
    .from(students)
    .leftJoin(classes, eq(students.classId, classes.id))
    .leftJoin(batches, eq(classes.batchId, batches.id))
    .leftJoin(departments, eq(classes.departmentId, departments.id))
    .leftJoin(academicYears, eq(classes.academicYearId, academicYears.id))
    .leftJoin(regulations, eq(classes.regulationId, regulations.id))
    .where(eq(students.id, id));
    
    return result[0];
  }

  async getStudentByRegisterNumber(registerNumber: string) {
    const result = await db.select({
      id: students.id,
      registerNumber: students.registerNumber,
      name: students.name,
      collegeEmail: students.collegeEmail,
      microsoftUserId: students.microsoftUserId,
      status: students.status,
      className: classes.name,
      classId: classes.id,
      batchName: batches.name,
      departmentCode: departments.code,
      academicYearName: academicYears.name,
      regulationName: regulations.name,
    })
    .from(students)
    .leftJoin(classes, eq(students.classId, classes.id))
    .leftJoin(batches, eq(classes.batchId, batches.id))
    .leftJoin(departments, eq(classes.departmentId, departments.id))
    .leftJoin(academicYears, eq(classes.academicYearId, academicYears.id))
    .leftJoin(regulations, eq(classes.regulationId, regulations.id))
    .where(eq(students.registerNumber, registerNumber));
    
    return result[0];
  }

  async getStudentByEmail(email: string) {
    const result = await db.select().from(students).where(eq(students.collegeEmail, email.toLowerCase()));
    return result[0];
  }

  async getStudentsByClass(classId: string) {
    return db.select().from(students).where(eq(students.classId, classId)).orderBy(students.registerNumber);
  }

  async createStudent(data: typeof students.$inferInsert) {
    return db.insert(students).values(data).returning();
  }

  async updateStudent(id: string, data: Partial<typeof students.$inferInsert>) {
    return db.update(students).set({ ...data, updatedAt: new Date() }).where(eq(students.id, id)).returning();
  }

  async getStudentReferenceCounts(id: string) {
    const [attCount, extCount, devCount] = await Promise.all([
      db.select({ count: sql<number>`cast(count(*) as integer)` }).from(attendanceRecords).where(eq(attendanceRecords.studentId, id)),
      db.select({ count: sql<number>`cast(count(*) as integer)` }).from(externalIdentities).where(eq(externalIdentities.studentId, id)),
      db.select({ count: sql<number>`cast(count(*) as integer)` }).from(studentBleDevices).where(eq(studentBleDevices.studentId, id)),
    ]);

    return {
      attendanceRecordsCount: Number(attCount[0]?.count || 0),
      externalIdentitiesCount: Number(extCount[0]?.count || 0),
      bleDevicesCount: Number(devCount[0]?.count || 0),
    };
  }

  async deleteStudent(id: string) {
    return db.transaction(async (tx) => {
      // Clean up child records that have no independent lifecycle
      await tx.delete(attendanceBleTokens).where(eq(attendanceBleTokens.studentId, id));
      await tx.delete(studentBleDevices).where(eq(studentBleDevices.studentId, id));
      await tx.delete(externalIdentities).where(eq(externalIdentities.studentId, id));
      return tx.delete(students).where(eq(students.id, id)).returning();
    });
  }

  async bulkCreateStudents(studentsData: (typeof students.$inferInsert)[]) {
    return db.transaction(async (tx) => {
      return tx.insert(students).values(studentsData).returning();
    });
  }

  async getClassByName(className: string) {
    const result = await db.select().from(classes).where(eq(classes.name, className));
    return result[0];
  }

  async getClassById(classId: string) {
    const result = await db.select().from(classes).where(eq(classes.id, classId));
    return result[0];
  }

  async getAllClasses() {
    return db.select().from(classes);
  }
}
