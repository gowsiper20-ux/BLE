import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import {
  departments,
  academicYears,
  batches,
  regulations,
  classes,
} from '../db/schema/academic';

export class AcademicRepository {
  // Departments
  async getDepartments() {
    return db.select().from(departments);
  }

  // Academic Years
  async getAcademicYears() {
    return db.select().from(academicYears).orderBy(academicYears.startDate);
  }
  
  async getAcademicYearById(id: string) {
    const result = await db.select().from(academicYears).where(eq(academicYears.id, id));
    return result[0];
  }

  async getAcademicYearByName(name: string) {
    const result = await db.select().from(academicYears).where(eq(academicYears.name, name));
    return result[0];
  }

  async getCurrentAcademicYear() {
    const result = await db.select().from(academicYears).where(eq(academicYears.isCurrent, true));
    return result[0];
  }

  async createAcademicYear(data: typeof academicYears.$inferInsert) {
    return db.insert(academicYears).values(data).returning();
  }

  async updateAcademicYear(id: string, data: Partial<typeof academicYears.$inferInsert>) {
    return db.update(academicYears).set({ ...data, updatedAt: new Date() }).where(eq(academicYears.id, id)).returning();
  }

  async deleteAcademicYear(id: string) {
    return db.delete(academicYears).where(eq(academicYears.id, id)).returning();
  }

  // Batches
  async getBatches() {
    return db
      .select({
        id: batches.id,
        name: batches.name,
        startYear: batches.startYear,
        endYear: batches.endYear,
        status: batches.status,
        departmentId: batches.departmentId,
        department: departments.code
      })
      .from(batches)
      .leftJoin(departments, eq(batches.departmentId, departments.id))
      .orderBy(batches.startYear);
  }

  async getBatchById(id: string) {
    const result = await db.select().from(batches).where(eq(batches.id, id));
    return result[0];
  }

  async getBatchByNameAndDept(name: string, deptId: string) {
    const result = await db.select().from(batches).where(and(eq(batches.name, name), eq(batches.departmentId, deptId)));
    return result[0];
  }

  async createBatch(data: typeof batches.$inferInsert) {
    return db.insert(batches).values(data).returning();
  }

  async updateBatch(id: string, data: Partial<typeof batches.$inferInsert>) {
    return db.update(batches).set({ ...data, updatedAt: new Date() }).where(eq(batches.id, id)).returning();
  }

  async deleteBatch(id: string) {
    return db.delete(batches).where(eq(batches.id, id)).returning();
  }

  // Regulations
  async getRegulations() {
    return db.select().from(regulations).orderBy(regulations.year);
  }

  async getRegulationById(id: string) {
    const result = await db.select().from(regulations).where(eq(regulations.id, id));
    return result[0];
  }

  async createRegulation(data: typeof regulations.$inferInsert) {
    return db.insert(regulations).values(data).returning();
  }

  async updateRegulation(id: string, data: Partial<typeof regulations.$inferInsert>) {
    return db.update(regulations).set({ ...data, updatedAt: new Date() }).where(eq(regulations.id, id)).returning();
  }

  async deleteRegulation(id: string) {
    return db.delete(regulations).where(eq(regulations.id, id)).returning();
  }

  // Classes
  async getClasses() {
    return db
      .select({
        id: classes.id,
        name: classes.name,
        yearNumber: classes.yearNumber,
        section: classes.section,
        status: classes.status,
        departmentId: classes.departmentId,
        academicYearId: classes.academicYearId,
        batchId: classes.batchId,
        regulationId: classes.regulationId,
        department: departments.code,
        academicYear: academicYears.name,
        batch: batches.name,
        regulation: regulations.name
      })
      .from(classes)
      .leftJoin(departments, eq(classes.departmentId, departments.id))
      .leftJoin(academicYears, eq(classes.academicYearId, academicYears.id))
      .leftJoin(batches, eq(classes.batchId, batches.id))
      .leftJoin(regulations, eq(classes.regulationId, regulations.id))
      .orderBy(classes.name);
  }

  async getClassById(id: string) {
    const result = await db.select().from(classes).where(eq(classes.id, id));
    return result[0];
  }

  async getClassByUniqueConstraint(departmentId: string, academicYearId: string, yearNumber: number, section: string) {
    const result = await db.select().from(classes).where(
      and(
        eq(classes.departmentId, departmentId),
        eq(classes.academicYearId, academicYearId),
        eq(classes.yearNumber, yearNumber),
        eq(classes.section, section)
      )
    );
    return result[0];
  }

  async createClass(data: typeof classes.$inferInsert) {
    return db.insert(classes).values(data).returning();
  }

  async updateClass(id: string, data: Partial<typeof classes.$inferInsert>) {
    return db.update(classes).set({ ...data, updatedAt: new Date() }).where(eq(classes.id, id)).returning();
  }

  async deleteClass(id: string) {
    return db.delete(classes).where(eq(classes.id, id)).returning();
  }
}
