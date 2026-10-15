import { db } from '../db';
import { attendanceBleTokens } from '../db/schema/attendance-ble-tokens';
import { eq, and } from 'drizzle-orm';

export class BleTokenRepository {
  async create(data: typeof attendanceBleTokens.$inferInsert) {
    const [result] = await db.insert(attendanceBleTokens).values(data).returning();
    return result;
  }

  async createMany(data: (typeof attendanceBleTokens.$inferInsert)[]) {
    return await db.insert(attendanceBleTokens).values(data).returning();
  }

  async findByHash(tokenHash: string) {
    const [result] = await db.select()
      .from(attendanceBleTokens)
      .where(eq(attendanceBleTokens.tokenHash, tokenHash))
      .limit(1);
    return result || null;
  }

  async findActiveBySessionAndStudent(sessionId: string, studentId: string) {
    const [result] = await db.select()
      .from(attendanceBleTokens)
      .where(
        and(
          eq(attendanceBleTokens.attendanceSessionId, sessionId),
          eq(attendanceBleTokens.studentId, studentId),
          eq(attendanceBleTokens.status, 'ACTIVE')
        )
      )
      .limit(1);
    return result || null;
  }

  async updateStatusForSession(sessionId: string, status: typeof attendanceBleTokens.$inferSelect.status) {
    return await db.update(attendanceBleTokens)
      .set({ status })
      .where(eq(attendanceBleTokens.attendanceSessionId, sessionId));
  }

  async upsertToken(data: typeof attendanceBleTokens.$inferInsert) {
    const [result] = await db.insert(attendanceBleTokens)
      .values(data)
      .onConflictDoUpdate({
        target: [attendanceBleTokens.attendanceSessionId, attendanceBleTokens.studentId],
        set: {
          tokenHash: data.tokenHash,
          issuedAt: data.issuedAt,
          expiresAt: data.expiresAt,
          status: data.status,
        }
      })
      .returning();
    return result;
  }
}
