import { db } from "../db";
import { periods } from "../db/schema/timetable";
import { eq, asc } from "drizzle-orm";

export class PeriodRepository {
  async findAll() {
    return await db.select().from(periods).orderBy(asc(periods.periodNumber));
  }

  async findById(id: string) {
    const [result] = await db.select().from(periods).where(eq(periods.id, id)).limit(1);
    return result || null;
  }

  async create(data: any) {
    const [result] = await db.insert(periods).values(data).returning();
    return result;
  }

  async update(id: string, data: any) {
    const [result] = await db.update(periods).set({ ...data, updatedAt: new Date() }).where(eq(periods.id, id)).returning();
    return result;
  }

  async delete(id: string) {
    await db.delete(periods).where(eq(periods.id, id));
  }
}
