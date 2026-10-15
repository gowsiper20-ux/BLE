import { db } from "../db";
import { timetableOverrides, timetables, periods } from "../db/schema/timetable";
import { subjects } from "../db/schema/subjects";
import { staff } from "../db/schema/staff";
import { classes } from "../db/schema/academic";
import { eq, and } from "drizzle-orm";

export class TimetableOverrideRepository {
  async findAll() {
    return await db
      .select({
        id: timetableOverrides.id,
        timetableId: timetableOverrides.timetableId,
        overrideDate: timetableOverrides.overrideDate,
        replacementStaffId: timetableOverrides.replacementStaffId,
        replacementSubjectId: timetableOverrides.replacementSubjectId,
        reason: timetableOverrides.reason,
        status: timetableOverrides.status,
        
        className: classes.name,
        periodName: periods.name,
        originalSubjectName: subjects.name,
        
        // Let's keep it simple
        replacementStaffName: staff.name
      })
      .from(timetableOverrides)
      .innerJoin(timetables, eq(timetableOverrides.timetableId, timetables.id))
      .innerJoin(classes, eq(timetables.classId, classes.id))
      .innerJoin(periods, eq(timetables.periodId, periods.id))
      .innerJoin(subjects, eq(timetables.subjectId, subjects.id))
      .leftJoin(staff, eq(timetableOverrides.replacementStaffId, staff.id));
  }

  async findById(id: string) {
    const [result] = await db.select().from(timetableOverrides).where(eq(timetableOverrides.id, id)).limit(1);
    return result || null;
  }

  async findByTimetableAndDate(timetableId: string, overrideDate: string) {
    const [result] = await db.select()
      .from(timetableOverrides)
      .where(and(
        eq(timetableOverrides.timetableId, timetableId),
        eq(timetableOverrides.overrideDate, overrideDate),
        eq(timetableOverrides.status, 'ACTIVE')
      ))
      .limit(1);
    return result || null;
  }

  async create(data: any) {
    const [result] = await db.insert(timetableOverrides).values(data).returning();
    return result;
  }

  async update(id: string, data: any) {
    const [result] = await db.update(timetableOverrides).set({ ...data, updatedAt: new Date() }).where(eq(timetableOverrides.id, id)).returning();
    return result;
  }

  async delete(id: string) {
    await db.delete(timetableOverrides).where(eq(timetableOverrides.id, id));
  }
}
