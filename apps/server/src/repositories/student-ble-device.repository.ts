import { db } from '../db';
import { studentBleDevices } from '../db/schema/student-ble-devices';
import { eq, and } from 'drizzle-orm';

export class StudentBleDeviceRepository {
  async create(data: typeof studentBleDevices.$inferInsert) {
    const [result] = await db.insert(studentBleDevices).values(data).returning();
    return result;
  }

  async findById(id: string) {
    const [result] = await db.select()
      .from(studentBleDevices)
      .where(eq(studentBleDevices.id, id))
      .limit(1);
    return result || null;
  }

  async findByStudentId(studentId: string) {
    return await db.select()
      .from(studentBleDevices)
      .where(eq(studentBleDevices.studentId, studentId));
  }

  async update(id: string, data: Partial<typeof studentBleDevices.$inferInsert>) {
    const [result] = await db.update(studentBleDevices)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(studentBleDevices.id, id))
      .returning();
    return result;
  }

  async delete(id: string) {
    return await db.delete(studentBleDevices).where(eq(studentBleDevices.id, id));
  }
}
