import { eq } from 'drizzle-orm';
import { db } from '../db';
import { staffCredentials } from '../db/schema/auth';

export class AuthRepository {
  async getCredentialsByStaffId(staffId: string) {
    const result = await db.select().from(staffCredentials).where(eq(staffCredentials.staffId, staffId));
    return result[0];
  }

  async createCredentials(staffId: string, passwordHash: string) {
    const result = await db.insert(staffCredentials).values({
      staffId,
      passwordHash
    }).returning();
    return result[0];
  }

  async updateCredentials(staffId: string, passwordHash: string) {
    const result = await db.update(staffCredentials)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(staffCredentials.staffId, staffId))
      .returning();
    return result[0];
  }
}
