import { eq, ilike, and, or, sql, inArray } from 'drizzle-orm';
import { db } from '../db';
import { staff, roles, staffRoles, classCounselors } from '../db/schema/staff';
import { classes, academicYears } from '../db/schema/academic';
import { timetables } from '../db/schema/timetable';
import { attendanceSessions } from '../db/schema/attendance';
import { attendanceRecords } from '../db/schema/attendance-records';
import { externalIdentities } from '../db/schema/auth';

export class StaffRepository {
  async getStaff(filters: { search?: string; status?: string; role?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (filters.search) {
      const q = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          ilike(staff.name, q),
          ilike(staff.staffCode, q),
          ilike(staff.collegeEmail, q)
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

    const countQuery = db
      .select({ count: sql<number>`cast(count(distinct ${staff.id}) as integer)` })
      .from(staff)
      .leftJoin(staffRoles, eq(staff.id, staffRoles.staffId))
      .leftJoin(roles, eq(staffRoles.roleId, roles.id))
      .where(whereClause);

    const [data, countResult] = await Promise.all([query, countQuery]);
    const total = Number(countResult[0]?.count || 0);

    return {
      staff: data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
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
    const result = await db.select().from(staff).where(eq(staff.staffCode, staffCode.trim()));
    return result[0];
  }

  async getStaffByEmail(email: string) {
    const result = await db.select().from(staff).where(eq(staff.collegeEmail, email.trim().toLowerCase()));
    return result[0];
  }

  async createStaffWithRoles(data: typeof staff.$inferInsert, roleNames: string[]) {
    return db.transaction(async (tx) => {
      let roleRecords = await tx.select().from(roles).where(inArray(roles.name, roleNames));
      if (roleNames.includes('STAFF') && !roleRecords.some((role) => role.name === 'STAFF')) {
        await tx.insert(roles)
          .values({ name: 'STAFF', description: 'Faculty and teaching staff' })
          .onConflictDoNothing();
        roleRecords = await tx.select().from(roles).where(inArray(roles.name, roleNames));
      }
      const missingRole = roleNames.find((roleName) => !roleRecords.some((role) => role.name === roleName));
      if (missingRole) throw new Error(`Role ${missingRole} does not exist.`);

      const [created] = await tx.insert(staff).values(data).returning();
      await tx.insert(staffRoles).values(
        roleRecords.map((role) => ({ staffId: created.id, roleId: role.id })),
      );
      return { ...created, roles: roleNames };
    });
  }

  async bulkCreateStaffWithConflicts(staffData: (typeof staff.$inferInsert)[]) {
    return db.transaction(async (tx) => {
      let staffRole = (await tx.select().from(roles).where(eq(roles.name, 'STAFF')))[0];
      if (!staffRole) {
        [staffRole] = await tx.insert(roles).values({ name: 'STAFF', description: 'Faculty and teaching staff' }).returning();
      }
      const created: Array<{ index: number; id: string }> = [];
      for (const [index, staffMember] of staffData.entries()) {
        const [row] = await tx
          .insert(staff)
          .values(staffMember)
          .onConflictDoNothing()
          .returning({ id: staff.id });
        if (!row) continue;
        await tx.insert(staffRoles).values({ staffId: row.id, roleId: staffRole.id }).onConflictDoNothing();
        created.push({ index, id: row.id });
      }
      return created;
    });
  }

  async updateStaff(id: string, data: Partial<typeof staff.$inferInsert>) {
    return db.update(staff).set({ ...data, updatedAt: new Date() }).where(eq(staff.id, id)).returning();
  }

  async getStaffReferenceCounts(id: string) {
    const [tCount, sCount, rCount, cCount, adminCount] = await Promise.all([
      db.select({ count: sql<number>`cast(count(*) as integer)` }).from(timetables).where(eq(timetables.staffId, id)),
      db.select({ count: sql<number>`cast(count(*) as integer)` }).from(attendanceSessions).where(eq(attendanceSessions.startedByStaffId, id)),
      db.select({ count: sql<number>`cast(count(*) as integer)` }).from(attendanceRecords).where(eq(attendanceRecords.markedBy, id)),
      db.select({ count: sql<number>`cast(count(*) as integer)` }).from(classCounselors).where(and(eq(classCounselors.staffId, id), eq(classCounselors.status, 'ACTIVE'))),
      db.select({ count: sql<number>`cast(count(distinct ${staff.id}) as integer)` })
        .from(staff)
        .innerJoin(staffRoles, eq(staff.id, staffRoles.staffId))
        .innerJoin(roles, eq(staffRoles.roleId, roles.id))
        .where(and(eq(roles.name, 'ADMIN'), eq(staff.status, 'ACTIVE'))),
    ]);

    return {
      timetablesCount: Number(tCount[0]?.count || 0),
      sessionsCount: Number(sCount[0]?.count || 0),
      markedRecordsCount: Number(rCount[0]?.count || 0),
      activeCounselorsCount: Number(cCount[0]?.count || 0),
      activeAdminCount: Number(adminCount[0]?.count || 0),
    };
  }

  async deleteStaff(id: string) {
    return db.transaction(async (tx) => {
      // First delete associated external identities, roles, and counselors
      await tx.delete(externalIdentities).where(eq(externalIdentities.staffId, id));
      await tx.delete(staffRoles).where(eq(staffRoles.staffId, id));
      await tx.delete(classCounselors).where(eq(classCounselors.staffId, id));
      
      // Then delete the staff member
      return tx.delete(staff).where(eq(staff.id, id)).returning();
    });
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

  async getCounselorById(id: string) {
    const result = await db.select().from(classCounselors).where(eq(classCounselors.id, id));
    return result[0];
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
}
