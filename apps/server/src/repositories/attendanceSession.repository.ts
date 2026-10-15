import { db } from '../db';
import { attendanceSessions } from '../db/schema/attendance';
import { timetables, periods } from '../db/schema/timetable';
import { classes } from '../db/schema/academic';
import { subjects } from '../db/schema/subjects';
import { staff } from '../db/schema/staff';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

export class AttendanceSessionRepository {
  async create(data: typeof attendanceSessions.$inferInsert) {
    const [result] = await db.insert(attendanceSessions).values(data).returning();
    return result;
  }

  async findById(id: string) {
    const [result] = await db.select({
        id: attendanceSessions.id,
        timetableId: attendanceSessions.timetableId,
        sessionDate: attendanceSessions.sessionDate,
        startedAt: attendanceSessions.startedAt,
        endedAt: attendanceSessions.endedAt,
        status: attendanceSessions.status,
        startedByStaffId: attendanceSessions.startedByStaffId,
        cancellationReason: attendanceSessions.cancellationReason,
        createdAt: attendanceSessions.createdAt,
        updatedAt: attendanceSessions.updatedAt,
        className: classes.name,
        subjectName: subjects.name,
        staffName: staff.name,
        periodName: periods.name,
        periodStartTime: periods.startTime,
        periodEndTime: periods.endTime
    })
    .from(attendanceSessions)
    .innerJoin(timetables, eq(attendanceSessions.timetableId, timetables.id))
    .innerJoin(classes, eq(timetables.classId, classes.id))
    .innerJoin(subjects, eq(timetables.subjectId, subjects.id))
    .leftJoin(staff, eq(attendanceSessions.startedByStaffId, staff.id))
    .innerJoin(periods, eq(timetables.periodId, periods.id))
    .where(eq(attendanceSessions.id, id));
    
    return result || null;
  }

  async findByTimetableAndDate(timetableId: string, date: string) {
    const [result] = await db.select()
      .from(attendanceSessions)
      .where(and(
        eq(attendanceSessions.timetableId, timetableId),
        eq(attendanceSessions.sessionDate, date)
      ));
    return result || null;
  }

  async update(id: string, data: Partial<typeof attendanceSessions.$inferInsert>) {
    const [result] = await db.update(attendanceSessions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(attendanceSessions.id, id))
      .returning();
    return result;
  }

  async updateStatus(id: string, status: typeof attendanceSessions.$inferSelect.status) {
    const [result] = await db.update(attendanceSessions)
      .set({ status, updatedAt: new Date() })
      .where(eq(attendanceSessions.id, id))
      .returning();
    return result;
  }

  async findAll(options?: {
    timetableId?: string;
    classId?: string;
    staffId?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }) {
    let conditions = [];
    if (options?.timetableId) conditions.push(eq(attendanceSessions.timetableId, options.timetableId));
    if (options?.classId) conditions.push(eq(timetables.classId, options.classId));
    if (options?.staffId) conditions.push(eq(attendanceSessions.startedByStaffId, options.staffId));
    if (options?.date) conditions.push(eq(attendanceSessions.sessionDate, options.date));
    if (options?.startDate) conditions.push(gte(attendanceSessions.sessionDate, options.startDate));
    if (options?.endDate) conditions.push(lte(attendanceSessions.sessionDate, options.endDate));
    if (options?.status) conditions.push(eq(attendanceSessions.status, options.status as any));

    return db.select({
        id: attendanceSessions.id,
        timetableId: attendanceSessions.timetableId,
        sessionDate: attendanceSessions.sessionDate,
        startedAt: attendanceSessions.startedAt,
        endedAt: attendanceSessions.endedAt,
        status: attendanceSessions.status,
        startedByStaffId: attendanceSessions.startedByStaffId,
        cancellationReason: attendanceSessions.cancellationReason,
        createdAt: attendanceSessions.createdAt,
        updatedAt: attendanceSessions.updatedAt,
        className: classes.name,
        subjectName: subjects.name,
        staffName: staff.name,
        periodName: periods.name,
        periodStartTime: periods.startTime,
        periodEndTime: periods.endTime
    })
      .from(attendanceSessions)
      .innerJoin(timetables, eq(attendanceSessions.timetableId, timetables.id))
      .innerJoin(classes, eq(timetables.classId, classes.id))
      .innerJoin(subjects, eq(timetables.subjectId, subjects.id))
      .leftJoin(staff, eq(attendanceSessions.startedByStaffId, staff.id))
      .innerJoin(periods, eq(timetables.periodId, periods.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(attendanceSessions.sessionDate));
  }
}
