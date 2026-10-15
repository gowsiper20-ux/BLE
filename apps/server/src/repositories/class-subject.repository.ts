import { db } from "../db";
import { classSubjects, subjects } from "../db/schema/subjects";
import { classes, academicYears, regulations } from "../db/schema/academic";
import { eq, and } from "drizzle-orm";

export class ClassSubjectRepository {
  async getByClassId(classId: string, academicYearId?: string) {
    const conditions = [eq(classSubjects.classId, classId)];
    if (academicYearId) conditions.push(eq(classSubjects.academicYearId, academicYearId));

    const results = await db
      .select({
        id: classSubjects.id,
        classId: classSubjects.classId,
        subjectId: classSubjects.subjectId,
        academicYearId: classSubjects.academicYearId,
        status: classSubjects.status,
        subjectCode: subjects.code,
        subjectName: subjects.name,
        subjectType: subjects.subjectType,
        yearNumber: subjects.yearNumber,
        regulationName: regulations.name
      })
      .from(classSubjects)
      .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .leftJoin(regulations, eq(subjects.regulationId, regulations.id))
      .where(and(...conditions));
    
    return results;
  }

  async getBySubjectId(subjectId: string, academicYearId?: string) {
    const conditions = [eq(classSubjects.subjectId, subjectId)];
    if (academicYearId) conditions.push(eq(classSubjects.academicYearId, academicYearId));

    const results = await db
      .select({
        id: classSubjects.id,
        classId: classSubjects.classId,
        subjectId: classSubjects.subjectId,
        academicYearId: classSubjects.academicYearId,
        status: classSubjects.status,
        className: classes.name,
        academicYearName: academicYears.name
      })
      .from(classSubjects)
      .innerJoin(classes, eq(classSubjects.classId, classes.id))
      .innerJoin(academicYears, eq(classSubjects.academicYearId, academicYears.id))
      .where(and(...conditions));
    
    return results;
  }

  async checkExists(classId: string, subjectId: string, academicYearId: string) {
    const [result] = await db
      .select()
      .from(classSubjects)
      .where(
        and(
          eq(classSubjects.classId, classId),
          eq(classSubjects.subjectId, subjectId),
          eq(classSubjects.academicYearId, academicYearId)
        )
      )
      .limit(1);
    
    return !!result;
  }

  async create(data: any) {
    const [result] = await db.insert(classSubjects).values(data).returning();
    return result;
  }

  async updateStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
    const [result] = await db.update(classSubjects).set({ status, updatedAt: new Date() }).where(eq(classSubjects.id, id)).returning();
    return result;
  }

  async delete(id: string) {
    await db.delete(classSubjects).where(eq(classSubjects.id, id));
  }
}
