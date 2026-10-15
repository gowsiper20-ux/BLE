import { db } from '../db';
import { attendanceRecords } from '../db/schema/attendance-records';
import { eq, and } from 'drizzle-orm';

export class AttendanceRecordRepository {
  async create(data: typeof attendanceRecords.$inferInsert) {
    const [result] = await db.insert(attendanceRecords).values(data).returning();
    return result;
  }

  async findBySessionAndStudent(sessionId: string, studentId: string) {
    const [result] = await db.select()
      .from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.attendanceSessionId, sessionId),
        eq(attendanceRecords.studentId, studentId)
      ))
      .limit(1);
    return result || null;
  }

  async update(id: string, data: Partial<typeof attendanceRecords.$inferInsert>) {
    const [result] = await db.update(attendanceRecords)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(attendanceRecords.id, id))
      .returning();
    return result;
  }

  async findAllBySession(sessionId: string) {
    return await db.select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.attendanceSessionId, sessionId));
  }
}
