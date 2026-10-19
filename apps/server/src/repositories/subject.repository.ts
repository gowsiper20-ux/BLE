import { db } from "../db";
import { subjects, classSubjects } from "../db/schema/subjects";
import { eq, and, like, or, sql } from "drizzle-orm";
import { regulations } from "../db/schema/academic";
import { timetables, timetableOverrides } from "../db/schema/timetable";

export class SubjectRepository {
  async findSubjects(params: { search?: string; type?: string; year?: number; regulationId?: string; status?: string; limit?: number; offset?: number }) {
    const conditions = [];

    if (params.search) {
      conditions.push(or(
        like(subjects.code, `%${params.search}%`),
        like(subjects.name, `%${params.search}%`)
      ));
    }

    if (params.type) conditions.push(eq(subjects.subjectType, params.type));
    if (params.year) conditions.push(eq(subjects.yearNumber, params.year));
    if (params.regulationId) conditions.push(eq(subjects.regulationId, params.regulationId));
    if (params.status) conditions.push(eq(subjects.status, params.status));

    const query = db
      .select({
        id: subjects.id,
        code: subjects.code,
        name: subjects.name,
        description: subjects.description,
        subjectType: subjects.subjectType,
        yearNumber: subjects.yearNumber,
        regulationId: subjects.regulationId,
        regulationName: regulations.name,
        status: subjects.status,
        createdAt: subjects.createdAt,
        updatedAt: subjects.updatedAt
      })
      .from(subjects)
      .leftJoin(regulations, eq(subjects.regulationId, regulations.id))
      .where(and(...conditions))
      .orderBy(subjects.code)
      .limit(params.limit || 20)
      .offset(params.offset || 0);

    const [countResult] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(subjects)
      .where(and(...conditions));

    const result = await query;

    return {
      data: result,
      total: countResult?.count || 0
    };
  }

  async findById(id: string) {
    const [result] = await db
      .select({
        id: subjects.id,
        code: subjects.code,
        name: subjects.name,
        description: subjects.description,
        subjectType: subjects.subjectType,
        yearNumber: subjects.yearNumber,
        regulationId: subjects.regulationId,
        regulationName: regulations.name,
        status: subjects.status,
        createdAt: subjects.createdAt,
        updatedAt: subjects.updatedAt
      })
      .from(subjects)
      .leftJoin(regulations, eq(subjects.regulationId, regulations.id))
      .where(eq(subjects.id, id))
      .limit(1);
    
    return result || null;
  }

  async findByCode(code: string) {
    const clean = code.trim();
    const [result] = await db
      .select()
      .from(subjects)
      .where(sql`lower(${subjects.code}) = lower(${clean})`)
      .limit(1);
    return result || null;
  }

  async getSubjectReferenceCounts(subjectId: string) {
    const [classSubResult] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(classSubjects)
      .where(eq(classSubjects.subjectId, subjectId));

    const [timetableResult] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(timetables)
      .where(eq(timetables.subjectId, subjectId));

    const [overrideResult] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(timetableOverrides)
      .where(eq(timetableOverrides.replacementSubjectId, subjectId));

    const classSubjectCount = classSubResult?.count || 0;
    const timetableCount = timetableResult?.count || 0;
    const overrideCount = overrideResult?.count || 0;

    return {
      classSubjectCount,
      timetableCount,
      overrideCount,
      total: classSubjectCount + timetableCount + overrideCount
    };
  }

  async create(data: any) {
    const [result] = await db.insert(subjects).values(data).returning();
    return result;
  }

  async update(id: string, data: any) {
    const [result] = await db.update(subjects).set({ ...data, updatedAt: new Date() }).where(eq(subjects.id, id)).returning();
    return result;
  }

  async delete(id: string) {
    await db.delete(subjects).where(eq(subjects.id, id));
  }
}
