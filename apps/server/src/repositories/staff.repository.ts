import { eq, ilike, and, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { staff, roles, staffRoles, classCounselors } from '../db/schema/staff';
import { classes, academicYears } from '../db/schema/academic';

export class StaffRepository {
  async getStaff(filters: { search?: string; status?: string; role?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (filters.search) {
      conditions.push(
        or(
          ilike(staff.name, `%${filters.search}%`),
          ilike(staff.staffCode, `%${filters.search}%`),
          ilike(staff.collegeEmail, `%${filters.search}%`)
        )
      );
    }
    
    if (filters.status) {
      conditions.push(eq(staff.status, filters.status as any));
    }

    if (filters.role) {
      conditions.push(eq(roles.name, filters.role));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // We group by staff to aggregate roles
    const query = db
      .select({
        id: staff.id,
        staffCode: staff.staffCode,
        name: staff.name,
        collegeEmail: staff.collegeEmail,
        microsoftUserId: staff.microsoftUserId,
        status: staff.status,
        roles: sql<string[]>`array_remove(array_agg(${roles.name}), NULL)`,
      })
      .from(staff)
      .leftJoin(staffRoles, eq(staff.id, staffRoles.staffId))
      .leftJoin(roles, eq(staffRoles.roleId, roles.id))
      .where(whereClause)
      .groupBy(staff.id)
      .limit(limit)
      .offset(offset)
      .orderBy(staff.staffCode);

    // Count is slightly tricky because of join, we can use a subquery or count distinct
    const countQuery = db
      .select({ count: sql<number>`count(distinct ${staff.id})` })
      .from(staff)
      .leftJoin(staffRoles, eq(staff.id, staffRoles.staffId))
      .leftJoin(roles, eq(staffRoles.roleId, roles.id))
      .where(whereClause);

    const [data, countResult] = await Promise.all([query, countQuery]);
    const total = Number(countResult[0].count);

    return {
      staff: data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getStaffById(id: string) {
    const result = await db
      .select({
        id: staff.id,
        staffCode: staff.staffCode,
        name: staff.name,
        collegeEmail: staff.collegeEmail,
        microsoftUserId: staff.microsoftUserId,
        status: staff.status,
        roles: sql<string[]>`array_remove(array_agg(${roles.name}), NULL)`,
      })
      .from(staff)
      .leftJoin(staffRoles, eq(staff.id, staffRoles.staffId))
      .leftJoin(roles, eq(staffRoles.roleId, roles.id))
      .where(eq(staff.id, id))
      .groupBy(staff.id);
      
    return result[0];
  }

  async getStaffByCode(staffCode: string) {
    const result = await db.select().from(staff).where(eq(staff.staffCode, staffCode));
    return result[0];
  }

  async getStaffByEmail(email: string) {
    const result = await db.select().from(staff).where(eq(staff.collegeEmail, email));
    return result[0];
  }

  async createStaff(data: typeof staff.$inferInsert) {
    return db.insert(staff).values(data).returning();
  }

  async updateStaff(id: string, data: Partial<typeof staff.$inferInsert>) {
    return db.update(staff).set({ ...data, updatedAt: new Date() }).where(eq(staff.id, id)).returning();
  }

  // --- Roles ---
  async getRoles() {
    return db.select().from(roles).orderBy(roles.name);
  }

  async getRoleByName(name: string) {
    const result = await db.select().from(roles).where(eq(roles.name, name));
    return result[0];
  }

  async getStaffRoles(staffId: string) {
    return db.select({
      id: staffRoles.id,
      roleId: roles.id,
      roleName: roles.name,
      description: roles.description
    })
    .from(staffRoles)
    .innerJoin(roles, eq(staffRoles.roleId, roles.id))
    .where(eq(staffRoles.staffId, staffId));
  }

  async assignRole(staffId: string, roleId: string) {
    return db.insert(staffRoles).values({ staffId, roleId }).onConflictDoNothing().returning();
  }

  async removeRole(staffId: string, roleId: string) {
    return db.delete(staffRoles).where(and(eq(staffRoles.staffId, staffId), eq(staffRoles.roleId, roleId))).returning();
  }

  // --- Class Counselors ---
  async getCounselors(filters: { classId?: string; academicYearId?: string; staffId?: string }) {
    const conditions = [];
    if (filters.classId) conditions.push(eq(classCounselors.classId, filters.classId));
    if (filters.academicYearId) conditions.push(eq(classCounselors.academicYearId, filters.academicYearId));
    if (filters.staffId) conditions.push(eq(classCounselors.staffId, filters.staffId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    return db.select({
      id: classCounselors.id,
      status: classCounselors.status,
      assignedAt: classCounselors.assignedAt,
      classId: classes.id,
      className: classes.name,
      staffId: staff.id,
      staffName: staff.name,
      academicYearId: academicYears.id,
      academicYearName: academicYears.name,
    })
    .from(classCounselors)
    .innerJoin(classes, eq(classCounselors.classId, classes.id))
    .innerJoin(staff, eq(classCounselors.staffId, staff.id))
    .innerJoin(academicYears, eq(classCounselors.academicYearId, academicYears.id))
    .where(whereClause)
    .orderBy(classes.name);
  }

  async getActiveCounselorForClass(classId: string, academicYearId: string) {
    const result = await db.select()
      .from(classCounselors)
      .where(and(
        eq(classCounselors.classId, classId),
        eq(classCounselors.academicYearId, academicYearId),
        eq(classCounselors.status, 'ACTIVE')
      ));
    return result[0];
  }

  async getActiveCounselorAssignmentForStaff(staffId: string, classId: string, academicYearId: string) {
    const result = await db.select()
      .from(classCounselors)
      .where(and(
        eq(classCounselors.staffId, staffId),
        eq(classCounselors.classId, classId),
        eq(classCounselors.academicYearId, academicYearId),
        eq(classCounselors.status, 'ACTIVE')
      ));
    return result[0];
  }

  async assignCounselor(data: typeof classCounselors.$inferInsert) {
    return db.insert(classCounselors).values(data).returning();
  }

  async updateCounselorStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
    return db.update(classCounselors).set({ status, updatedAt: new Date() }).where(eq(classCounselors.id, id)).returning();
  }

  async deleteCounselorAssignment(id: string) {
    return db.delete(classCounselors).where(eq(classCounselors.id, id)).returning();
  }

  async deleteStaff(id: string) {
    return db.transaction(async (tx) => {
      // First delete associated roles and counselors
      await tx.delete(staffRoles).where(eq(staffRoles.staffId, id));
      await tx.delete(classCounselors).where(eq(classCounselors.staffId, id));
      
      // Then delete the staff member
      return tx.delete(staff).where(eq(staff.id, id)).returning();
    });
  }
}
