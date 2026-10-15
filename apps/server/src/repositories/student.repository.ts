import { eq, ilike, and, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { students } from '../db/schema/students';
import { classes, batches, academicYears, departments, regulations } from '../db/schema/academic';

export class StudentRepository {
  async getStudents(filters: { search?: string; classId?: string; status?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (filters.search) {
      conditions.push(
        or(
          ilike(students.name, `%${filters.search}%`),
          ilike(students.registerNumber, `%${filters.search}%`),
          ilike(students.collegeEmail, `%${filters.search}%`)
        )
      );
    }
    
    if (filters.classId) {
      conditions.push(eq(students.classId, filters.classId));
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
      .select({ count: sql<number>`count(*)` })
      .from(students)
      .where(whereClause);

    const [data, countResult] = await Promise.all([query, countQuery]);
    const total = Number(countResult[0].count);

    return {
      students: data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
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
    const result = await db.select().from(students).where(eq(students.collegeEmail, email));
    return result[0];
  }

  async getStudentsByClass(classId: string) {
    return await db.select().from(students).where(eq(students.classId, classId));
  }

  async createStudent(data: typeof students.$inferInsert) {
    return db.insert(students).values(data).returning();
  }

  async updateStudent(id: string, data: Partial<typeof students.$inferInsert>) {
    return db.update(students).set({ ...data, updatedAt: new Date() }).where(eq(students.id, id)).returning();
  }

  async bulkCreateStudents(studentsData: (typeof students.$inferInsert)[]) {
    return db.transaction(async (tx: any) => {
      // Chunking if the array is very large, but Drizzle can insert thousands at once.
      // Assuming class size or normal batch size < 1000
      return tx.insert(students).values(studentsData).returning();
    });
  }

  // Find class by name for import resolution
  async getClassByName(className: string) {
    const result = await db.select().from(classes).where(eq(classes.name, className));
    return result[0];
  }
}
