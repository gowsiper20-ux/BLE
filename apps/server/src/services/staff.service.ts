import { StaffRepository } from '../repositories/staff.repository';
import { staff, classCounselors } from '../db/schema/staff';
import { AuditService } from './audit.service';

export class StaffService {
  private repo: StaffRepository;
  private audit: AuditService;

  constructor() {
    this.repo = new StaffRepository();
    this.audit = new AuditService();
  }

  // --- Staff ---
  async getStaff(filters: any) {
    return this.repo.getStaff(filters);
  }

  async getStaffById(id: string) {
    return this.repo.getStaffById(id);
  }

  async createStaff(data: typeof staff.$inferInsert & { roles?: string[] }) {
    const existingCode = await this.repo.getStaffByCode(data.staffCode);
    if (existingCode) {
      throw new Error('Staff with this staff code already exists.');
    }

    const existingEmail = await this.repo.getStaffByEmail(data.collegeEmail);
    if (existingEmail) {
      throw new Error('Staff with this college email already exists.');
    }

    const { roles, ...staffData } = data;

    const [created] = await this.repo.createStaff(staffData as any);
    
    if (roles && roles.length > 0) {
      for (const roleName of roles) {
        await this.assignRole(created.id, roleName);
      }
    }
    
    await this.audit.log({
      action: 'CREATE',
      entityType: 'STAFF',
      entityId: created.id,
      description: `Created staff member ${created.name} (${created.staffCode})`,
      newValues: { ...created, roles },
    });

    return created;
  }

  async updateStaff(id: string, data: Partial<typeof staff.$inferInsert> & { roles?: string[] }) {
    if (data.staffCode) {
      const existing = await this.repo.getStaffByCode(data.staffCode);
      if (existing && existing.id !== id) {
        throw new Error('Staff with this staff code already exists.');
      }
    }

    if (data.collegeEmail) {
      const existing = await this.repo.getStaffByEmail(data.collegeEmail);
      if (existing && existing.id !== id) {
        throw new Error('Staff with this college email already exists.');
      }
    }

    const { roles, ...staffData } = data;

    const old = await this.repo.getStaffById(id);
    let updated = null;
    
    if (Object.keys(staffData).length > 0) {
      const [res] = await this.repo.updateStaff(id, staffData as any);
      updated = res;
    } else {
      updated = old;
    }

    if (roles) {
      const currentRoles = await this.repo.getStaffRoles(id);
      const currentRoleNames = currentRoles.map(r => r.roleName);
      
      const toAdd = roles.filter(r => !currentRoleNames.includes(r));
      const toRemove = currentRoleNames.filter(r => !roles.includes(r));
      
      for (const roleName of toAdd) {
        await this.assignRole(id, roleName);
      }
      for (const roleName of toRemove) {
        await this.removeRole(id, roleName);
      }
    }

    if (old) {
      await this.audit.log({
        action: 'UPDATE',
        entityType: 'STAFF',
        entityId: id,
        description: `Updated staff member ${updated.name} (${updated.staffCode})`,
        oldValues: old,
        newValues: { ...updated, roles },
      });
    }

    return updated;
  }

  async updateStaffStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
    const old = await this.repo.getStaffById(id);
    const [updated] = await this.repo.updateStaff(id, { status });

    if (old) {
      await this.audit.log({
        action: 'UPDATE',
        entityType: 'STAFF',
        entityId: id,
        description: `Changed staff status to ${status}`,
        oldValues: { status: old.status },
        newValues: { status },
      });
    }

    return updated;
  }

  async deleteStaff(id: string) {
    const old = await this.repo.getStaffById(id);
    if (!old) {
      throw new Error('Staff not found');
    }
    
    // Check if the staff member is a test staff (e.g. no dependent records other than roles/counselors)
    // For now we just attempt hard delete, catching any foreign key constraint errors
    try {
      const [deleted] = await this.repo.deleteStaff(id);
      
      await this.audit.log({
        action: 'DELETE',
        entityType: 'STAFF',
        entityId: id,
        description: `Deleted staff member ${old.name} (${old.staffCode})`,
        oldValues: old,
      });
      
      return deleted;
    } catch (error: any) {
      if (error.code === '23503') { // PostgreSQL foreign_key_violation
        throw new Error('Cannot delete staff member with existing dependent records (e.g., attendance, timetable). Deactivate them instead.');
      }
      throw error;
    }
  }

  // --- Roles ---
  async getRoles() {
    return this.repo.getRoles();
  }

  async getStaffRoles(staffId: string) {
    return this.repo.getStaffRoles(staffId);
  }

  async assignRole(staffId: string, roleName: string) {
    const role = await this.repo.getRoleByName(roleName);
    if (!role) {
      throw new Error(`Role ${roleName} does not exist.`);
    }
    const [assigned] = await this.repo.assignRole(staffId, role.id);
    
    await this.audit.log({
      action: 'ASSIGN',
      entityType: 'STAFF',
      entityId: staffId,
      description: `Assigned role ${roleName} to staff`,
    });

    return assigned;
  }

  async removeRole(staffId: string, roleName: string) {
    const role = await this.repo.getRoleByName(roleName);
    if (!role) {
      throw new Error(`Role ${roleName} does not exist.`);
    }
    // Business rule: Prevent removing STAFF role? Maybe later.
    const [removed] = await this.repo.removeRole(staffId, role.id);

    await this.audit.log({
      action: 'UNASSIGN',
      entityType: 'STAFF',
      entityId: staffId,
      description: `Removed role ${roleName} from staff`,
    });

    return removed;
  }

  // --- Class Counselors ---
  async getCounselorAssignments(filters: any) {
    return this.repo.getCounselors(filters);
  }

  async assignCounselor(data: typeof classCounselors.$inferInsert) {
    // 1. Verify staff is active
    const staffMember = await this.repo.getStaffById(data.staffId);
    if (!staffMember) throw new Error('Staff member not found.');
    if (staffMember.status !== 'ACTIVE') throw new Error('Cannot assign counselor role to inactive staff.');

    // 2. Verify no other active counselor exists for this class + academic year
    const existingActive = await this.repo.getActiveCounselorForClass(data.classId, data.academicYearId);
    if (existingActive && existingActive.staffId !== data.staffId) {
      throw new Error('An active counselor already exists for this class in this academic year.');
    }

    // 3. Verify this staff isn't already assigned actively to this class (duplicate check)
    const existingSelf = await this.repo.getActiveCounselorAssignmentForStaff(data.staffId, data.classId, data.academicYearId);
    if (existingSelf) {
      throw new Error('Staff is already the active counselor for this class.');
    }

    const [created] = await this.repo.assignCounselor(data);
    return created;
  }

  async updateCounselorStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
    const [updated] = await this.repo.updateCounselorStatus(id, status);
    return updated;
  }

  async deleteCounselorAssignment(id: string) {
    const [deleted] = await this.repo.deleteCounselorAssignment(id);
    return deleted;
  }
}
