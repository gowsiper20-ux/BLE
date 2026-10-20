import { StaffRepository } from '../repositories/staff.repository';
import { staff, classCounselors } from '../db/schema/staff';
import { AuditService } from './audit.service';
import type { Buffer } from 'node:buffer';
import { parseTabularImport } from './tabular-import';

export interface AuditActor {
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
}

const ALLOWED_STAFF_ROLES = ['ADMIN', 'HOD', 'DEPUTY_HOD', 'CLASS_COUNSELOR', 'STAFF'];

export class StaffService {
  private repo: StaffRepository;
  private audit: AuditService;
  private allowedDomains: string[];

  constructor() {
    this.repo = new StaffRepository();
    this.audit = new AuditService();
    const envDomain = process.env.COLLEGE_EMAIL_DOMAIN || 'sonatech.ac.in';
    this.allowedDomains = envDomain.toLowerCase().split(',').map(d => d.trim().replace(/^@/, ''));
  }

  async validateImportFile(fileBuffer: Buffer, fileName: string) {
    const rows = parseTabularImport(fileBuffer, fileName, {
      staff_code: 'staff_code',
      staff_id: 'staff_code',
      name: 'name',
      full_name: 'name',
      college_email: 'college_email',
      email: 'college_email',
    }, ['staff_code', 'name', 'college_email']);
    const codeCounts = new Map<string, number>();
    const emailCounts = new Map<string, number>();
    for (const row of rows) {
      const code = row.staff_code.toUpperCase();
      const email = row.college_email.toLowerCase();
      if (code) codeCounts.set(code, (codeCounts.get(code) || 0) + 1);
      if (email) emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
    }

    const data = await Promise.all(rows.map(async (row, index) => {
      const staffCode = row.staff_code.toUpperCase();
      const name = row.name.trim();
      const collegeEmail = row.college_email.toLowerCase();
      const errors: { code: string; message: string }[] = [];
      if (!staffCode) errors.push({ code: 'MISSING_STAFF_CODE', message: 'Staff code is required.' });
      else if (!/^[A-Z0-9_-]{3,30}$/.test(staffCode)) errors.push({ code: 'INVALID_STAFF_CODE', message: 'Staff code must be 3-30 alphanumeric characters, hyphens, or underscores.' });
      if (name.length < 2 || name.length > 255) errors.push({ code: 'INVALID_NAME', message: 'Faculty name must be 2-255 characters.' });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(collegeEmail)) {
        errors.push({ code: 'INVALID_EMAIL', message: 'Enter a valid college email address.' });
      } else if (!this.allowedDomains.some((domain) => collegeEmail.endsWith(`@${domain}`))) {
        errors.push({ code: 'INVALID_DOMAIN', message: `College email must belong to one of: ${this.allowedDomains.join(', ')}.` });
      }
      if (staffCode && (codeCounts.get(staffCode) || 0) > 1) {
        errors.push({ code: 'DUPLICATE_STAFF_CODE', message: 'Staff code is duplicated in the uploaded file.' });
      }
      if (collegeEmail && (emailCounts.get(collegeEmail) || 0) > 1) {
        errors.push({ code: 'DUPLICATE_EMAIL', message: 'Email is duplicated in the uploaded file.' });
      }
      if (staffCode && await this.repo.getStaffByCode(staffCode)) {
        errors.push({ code: 'STAFF_CODE_EXISTS', message: 'Staff code already exists in the database.' });
      }
      if (collegeEmail && await this.repo.getStaffByEmail(collegeEmail)) {
        errors.push({ code: 'EMAIL_EXISTS', message: 'Email already exists in the database.' });
      }
      return {
        rowNumber: index + 2,
        staffCode,
        name,
        collegeEmail,
        isValid: errors.length === 0,
        errors,
      };
    }));
    const valid = data.filter((row) => row.isValid).length;
    return { totalRows: data.length, valid, errors: data.length - valid, data };
  }

  async confirmImport(fileBuffer: Buffer, fileName: string, actor?: AuditActor) {
    const preview = await this.validateImportFile(fileBuffer, fileName);
    const candidates = preview.data.filter((row) => row.isValid);
    const createdRows = await this.repo.bulkCreateStaffWithConflicts(candidates.map((row) => ({
      staffCode: row.staffCode,
      name: row.name,
      collegeEmail: row.collegeEmail,
      status: 'ACTIVE' as const,
    })));
    const createdIndexes = new Set(createdRows.map((row) => row.index));
    const results = preview.data.map((row) => {
      const candidateIndex = candidates.indexOf(row);
      if (candidateIndex >= 0 && createdIndexes.has(candidateIndex)) {
        return { rowNumber: row.rowNumber, status: 'created' as const, errors: [] };
      }
      const errors = row.errors.length
        ? row.errors
        : [{ code: 'DUPLICATE_CONFLICT', message: 'A record with this staff code or email was created concurrently; nothing was overwritten.' }];
      return { rowNumber: row.rowNumber, status: 'skipped' as const, errors };
    });
    const created = createdRows.length;
    const skipped = results.length - created;
    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: 'BULK_IMPORT_STAFF',
      entityType: 'STAFF',
      description: `Faculty import finished: ${created} created, ${skipped} skipped.`,
      newValues: { total: results.length, created, skipped },
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
    });
    return { total: results.length, created, skipped, failed: 0, rows: results };
  }

  private validateEmail(email?: string): string {
    if (!email || typeof email !== 'string' || !email.trim()) {
      throw new Error('College email is required.');
    }
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
      throw new Error('Invalid email format.');
    }
    const matchesDomain = this.allowedDomains.some(d => clean.endsWith(`@${d}`));
    if (!matchesDomain) {
      throw new Error(`College email must belong to '@${this.allowedDomains[0]}'.`);
    }
    return clean;
  }

  private validateStaffCode(code?: string): string {
    if (!code || typeof code !== 'string' || !code.trim()) {
      throw new Error('Staff code is required.');
    }
    const clean = code.trim().toUpperCase();
    if (!/^[A-Z0-9\-_]{3,30}$/.test(clean)) {
      throw new Error('Staff code must be 3 to 30 alphanumeric characters or hyphens.');
    }
    return clean;
  }

  private validateName(name?: string): string {
    if (!name || typeof name !== 'string' || !name.trim() || name.trim().length < 2) {
      throw new Error('Staff name must be at least 2 characters long.');
    }
    return name.trim();
  }

  // --- Staff CRUD ---
  async getStaff(filters: any) {
    return this.repo.getStaff(filters);
  }

  async getStaffById(id: string) {
    return this.repo.getStaffById(id);
  }

  async createStaff(data: typeof staff.$inferInsert & { roles?: string[] }, actor?: AuditActor) {
    const staffCode = this.validateStaffCode(data.staffCode);
    const collegeEmail = this.validateEmail(data.collegeEmail);
    const name = this.validateName(data.name);

    const existingCode = await this.repo.getStaffByCode(staffCode);
    if (existingCode) {
      throw new Error('Staff with this staff code already exists.');
    }

    const existingEmail = await this.repo.getStaffByEmail(collegeEmail);
    if (existingEmail) {
      throw new Error('Staff with this college email already exists.');
    }

    const { roles: inputRoles, ...staffData } = data;

    const rolesToAssign = [...new Set((inputRoles && inputRoles.length > 0) ? inputRoles : ['STAFF'])];
    for (const roleName of rolesToAssign) {
      if (!ALLOWED_STAFF_ROLES.includes(roleName)) {
        throw new Error(`Invalid role '${roleName}'. Allowed roles: ${ALLOWED_STAFF_ROLES.join(', ')}.`);
      }
    }

    const created = await this.repo.createStaffWithRoles({
      ...staffData,
      staffCode,
      collegeEmail,
      name,
    }, rolesToAssign);
    
    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: 'CREATE_STAFF',
      entityType: 'STAFF',
      entityId: created.id,
      description: `Created staff member "${created.name}" (${created.staffCode})`,
      newValues: { ...created, roles: rolesToAssign },
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
    });

    return { ...created, roles: rolesToAssign };
  }

  async updateStaff(id: string, data: Partial<typeof staff.$inferInsert> & { roles?: string[] }, actor?: AuditActor) {
    const old = await this.repo.getStaffById(id);
    if (!old) {
      throw new Error('Staff not found');
    }

    const updatePayload: Partial<typeof staff.$inferInsert> = {};

    if (data.staffCode !== undefined) {
      const code = this.validateStaffCode(data.staffCode);
      const existing = await this.repo.getStaffByCode(code);
      if (existing && existing.id !== id) {
        throw new Error('Staff with this staff code already exists.');
      }
      updatePayload.staffCode = code;
    }

    if (data.collegeEmail !== undefined) {
      const email = this.validateEmail(data.collegeEmail);
      const existing = await this.repo.getStaffByEmail(email);
      if (existing && existing.id !== id) {
        throw new Error('Staff with this college email already exists.');
      }
      updatePayload.collegeEmail = email;
    }

    if (data.name !== undefined) {
      updatePayload.name = this.validateName(data.name);
    }

    if (data.status !== undefined) {
      updatePayload.status = data.status;
    }

    let updated = old;
    if (Object.keys(updatePayload).length > 0) {
      const [res] = await this.repo.updateStaff(id, updatePayload);
      updated = { ...res, roles: old.roles };
    }

    if (data.roles) {
      const currentRoles = await this.repo.getStaffRoles(id);
      const currentRoleNames = currentRoles.map(r => r.roleName);
      
      const toAdd = data.roles.filter(r => !currentRoleNames.includes(r));
      const toRemove = currentRoleNames.filter(r => !data.roles!.includes(r));
      
      for (const roleName of toAdd) {
        await this.assignRole(id, roleName, actor);
      }
      for (const roleName of toRemove) {
        await this.removeRole(id, roleName, actor);
      }
    }

    const currentRoles = await this.repo.getStaffRoles(id);
    const finalResult = {
      ...updated,
      roles: currentRoles.map(r => r.roleName),
    };

    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: 'UPDATE_STAFF',
      entityType: 'STAFF',
      entityId: id,
      description: `Updated staff member "${updated.name}" (${updated.staffCode})`,
      oldValues: old,
      newValues: finalResult,
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
    });

    return finalResult;
  }

  async updateStaffStatus(id: string, status: 'ACTIVE' | 'INACTIVE', actor?: AuditActor) {
    const old = await this.repo.getStaffById(id);
    if (!old) {
      throw new Error('Staff not found');
    }

    // Protect against deactivating the only active administrator
    if (status === 'INACTIVE' && old.roles?.includes('ADMIN')) {
      const refs = await this.repo.getStaffReferenceCounts(id);
      if (refs.activeAdminCount <= 1) {
        throw new Error('Cannot deactivate the only active Administrator in the system.');
      }
    }

    const [updated] = await this.repo.updateStaff(id, { status });

    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: 'UPDATE_STAFF_STATUS',
      entityType: 'STAFF',
      entityId: id,
      description: `Changed staff "${old.name}" (${old.staffCode}) status from ${old.status} to ${status}`,
      oldValues: { status: old.status },
      newValues: { status },
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
    });

    return updated;
  }

  async deleteStaff(id: string, actor?: AuditActor) {
    const old = await this.repo.getStaffById(id);
    if (!old) {
      throw new Error('Staff not found');
    }
    
    // Check referential integrity
    const refs = await this.repo.getStaffReferenceCounts(id);
    const conflicts: string[] = [];

    if (refs.timetablesCount > 0) {
      conflicts.push(`${refs.timetablesCount} timetable schedule(s)`);
    }
    if (refs.sessionsCount > 0) {
      conflicts.push(`${refs.sessionsCount} attendance session(s)`);
    }
    if (refs.markedRecordsCount > 0) {
      conflicts.push(`${refs.markedRecordsCount} marked attendance record(s)`);
    }
    if (refs.activeCounselorsCount > 0) {
      conflicts.push(`${refs.activeCounselorsCount} active counselor assignment(s)`);
    }

    if (conflicts.length > 0) {
      throw new Error(`Cannot delete staff member: ${conflicts.join(', ')} are associated with this staff member. Deactivate them instead.`);
    }

    // Invariant: Never delete the last active administrator
    if (old.roles?.includes('ADMIN') && refs.activeAdminCount <= 1) {
      throw new Error('Cannot delete the last remaining active Administrator in the system.');
    }

    const [deleted] = await this.repo.deleteStaff(id);
    
    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: 'DELETE_STAFF',
      entityType: 'STAFF',
      entityId: id,
      description: `Deleted staff member "${old.name}" (${old.staffCode})`,
      oldValues: old,
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
    });
    
    return deleted;
  }

  // --- Roles ---
  async getRoles() {
    return this.repo.getRoles();
  }

  async getStaffRoles(staffId: string) {
    return this.repo.getStaffRoles(staffId);
  }

  async assignRole(staffId: string, roleName: string, actor?: AuditActor) {
    if (!ALLOWED_STAFF_ROLES.includes(roleName)) {
      throw new Error(`Invalid role '${roleName}'. Allowed roles: ${ALLOWED_STAFF_ROLES.join(', ')}.`);
    }

    const staffMember = await this.repo.getStaffById(staffId);
    if (!staffMember) {
      throw new Error('Staff member not found.');
    }

    const role = await this.repo.getRoleByName(roleName);
    if (!role) {
      throw new Error(`Role ${roleName} does not exist.`);
    }

    const [assigned] = await this.repo.assignRole(staffId, role.id);
    
    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: 'ASSIGN_STAFF_ROLE',
      entityType: 'STAFF',
      entityId: staffId,
      description: `Assigned role "${roleName}" to staff "${staffMember.name}"`,
      newValues: { staffId, roleName },
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
    });

    return assigned;
  }

  async removeRole(staffId: string, roleName: string, actor?: AuditActor) {
    const staffMember = await this.repo.getStaffById(staffId);
    if (!staffMember) {
      throw new Error('Staff member not found.');
    }

    // Invariant: Do not remove the last remaining ADMIN role in the system
    if (roleName === 'ADMIN') {
      const refs = await this.repo.getStaffReferenceCounts(staffId);
      if (refs.activeAdminCount <= 1) {
        throw new Error('Cannot remove ADMIN role: system must always have at least one active administrator.');
      }
    }

    const role = await this.repo.getRoleByName(roleName);
    if (!role) {
      throw new Error(`Role ${roleName} does not exist.`);
    }

    const [removed] = await this.repo.removeRole(staffId, role.id);

    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: 'REMOVE_STAFF_ROLE',
      entityType: 'STAFF',
      entityId: staffId,
      description: `Removed role "${roleName}" from staff "${staffMember.name}"`,
      oldValues: { staffId, roleName },
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
    });

    return removed;
  }

  // --- Class Counselors ---
  async getCounselorAssignments(filters: any) {
    return this.repo.getCounselors(filters);
  }

  async assignCounselor(data: typeof classCounselors.$inferInsert, actor?: AuditActor) {
    // 1. Verify staff is active
    const staffMember = await this.repo.getStaffById(data.staffId);
    if (!staffMember) throw new Error('Staff member not found.');
    if (staffMember.status !== 'ACTIVE') throw new Error('Cannot assign counselor role to inactive staff.');

    // 2. Verify no other active counselor exists for this class + academic year
    const existingActive = await this.repo.getActiveCounselorForClass(data.classId, data.academicYearId);
    if (existingActive && existingActive.staffId !== data.staffId) {
      throw new Error('An active counselor already exists for this class in this academic year.');
    }

    // 3. Verify this staff isn't already assigned actively to this class
    const existingSelf = await this.repo.getActiveCounselorAssignmentForStaff(data.staffId, data.classId, data.academicYearId);
    if (existingSelf) {
      throw new Error('Staff is already the active counselor for this class.');
    }

    const [created] = await this.repo.assignCounselor(data);

    // Auto-assign CLASS_COUNSELOR role if staff doesn't have it
    const roles = await this.repo.getStaffRoles(data.staffId);
    if (!roles.some(r => r.roleName === 'CLASS_COUNSELOR')) {
      await this.assignRole(data.staffId, 'CLASS_COUNSELOR', actor);
    }

    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: 'ASSIGN_COUNSELOR',
      entityType: 'COUNSELOR',
      entityId: created.id,
      description: `Assigned staff "${staffMember.name}" as counselor to class ${data.classId}`,
      newValues: created,
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
    });

    return created;
  }

  async updateCounselorStatus(id: string, status: 'ACTIVE' | 'INACTIVE', actor?: AuditActor) {
    const existing = await this.repo.getCounselorById(id);
    if (!existing) throw new Error('Counselor assignment not found.');

    const [updated] = await this.repo.updateCounselorStatus(id, status);

    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: 'UPDATE_COUNSELOR_STATUS',
      entityType: 'COUNSELOR',
      entityId: id,
      description: `Updated class counselor assignment status to ${status}`,
      oldValues: existing,
      newValues: updated,
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
    });

    return updated;
  }

  async deleteCounselorAssignment(id: string, actor?: AuditActor) {
    const existing = await this.repo.getCounselorById(id);
    if (!existing) throw new Error('Counselor assignment not found.');

    const [deleted] = await this.repo.deleteCounselorAssignment(id);

    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: 'DELETE_COUNSELOR',
      entityType: 'COUNSELOR',
      entityId: id,
      description: `Deleted class counselor assignment ${id}`,
      oldValues: existing,
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
    });

    return deleted;
  }
}
