import { TimetableRepository } from "../repositories/timetable.repository";
import { ClassSubjectRepository } from "../repositories/class-subject.repository";
import { StaffRepository } from "../repositories/staff.repository";
import { AuditService } from "./audit.service";
import type { AuditActor } from "./staff.service";

export class TimetableService {
  private repo: TimetableRepository;
  private classSubjectRepo: ClassSubjectRepository;
  private staffRepo: StaffRepository;
  private audit: AuditService;

  constructor() {
    this.repo = new TimetableRepository();
    this.classSubjectRepo = new ClassSubjectRepository();
    this.staffRepo = new StaffRepository();
    this.audit = new AuditService();
  }

  async getTimetableByClass(classId: string, academicYearId?: string) {
    return await this.repo.findByClass(classId, academicYearId);
  }

  async getTimetableByStaff(staffId: string, academicYearId?: string) {
    return await this.repo.findByStaff(staffId, academicYearId);
  }

  async createTimetableEntry(data: any, actor?: AuditActor) {
    // Basic validation
    if (!data.academicYearId || !data.classId || !data.dayOfWeek || !data.periodId || !data.subjectId || !data.staffId) {
      throw new Error("Missing required fields");
    }

    // 1. Ensure subject is assigned to class
    const isAssigned = await this.classSubjectRepo.checkExists(data.classId, data.subjectId, data.academicYearId);
    if (!isAssigned) {
      await this.classSubjectRepo.create({
        classId: data.classId,
        subjectId: data.subjectId,
        academicYearId: data.academicYearId,
        status: 'ACTIVE'
      });
    }

    // 2. Validate active staff
    const staffMember = await this.staffRepo.getStaffById(data.staffId);
    if (!staffMember) throw new Error("STAFF_NOT_FOUND");
    if (staffMember.status !== 'ACTIVE') throw new Error("STAFF_INACTIVE");

    // 3. Class conflict
    const classConflict = await this.repo.checkClassConflict(data.academicYearId, data.classId, data.dayOfWeek, data.periodId);
    if (classConflict) throw new Error("CLASS_TIMETABLE_CONFLICT");

    // 4. Staff conflict
    const staffConflict = await this.repo.checkStaffConflict(data.academicYearId, data.staffId, data.dayOfWeek, data.periodId);
    if (staffConflict) throw new Error("STAFF_TIMETABLE_CONFLICT");

    const entry = await this.repo.create(data);

    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: "CREATE_TIMETABLE_ENTRY",
      entityType: "TIMETABLE",
      entityId: entry.id,
      description: `Created timetable entry for class ${data.classId}, day ${data.dayOfWeek}, period ${data.periodId}`,
      newValues: data,
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
    });

    return entry;
  }

  async updateTimetableEntry(id: string, data: any, actor?: AuditActor) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new Error("TIMETABLE_NOT_FOUND");

    const merged = { ...existing, ...data };

    if (data.subjectId && data.subjectId !== existing.subjectId) {
      const isAssigned = await this.classSubjectRepo.checkExists(merged.classId, merged.subjectId, merged.academicYearId);
      if (!isAssigned) {
        await this.classSubjectRepo.create({
          classId: merged.classId,
          subjectId: merged.subjectId,
          academicYearId: merged.academicYearId,
          status: 'ACTIVE'
        });
      }
    }

    // Conflicts validation (excluding current id)
    if (data.classId || data.dayOfWeek || data.periodId || data.academicYearId) {
      const classConflict = await this.repo.checkClassConflict(merged.academicYearId, merged.classId, merged.dayOfWeek, merged.periodId, id);
      if (classConflict) throw new Error("CLASS_TIMETABLE_CONFLICT");
    }

    if (data.staffId || data.dayOfWeek || data.periodId || data.academicYearId) {
      const staffConflict = await this.repo.checkStaffConflict(merged.academicYearId, merged.staffId, merged.dayOfWeek, merged.periodId, id);
      if (staffConflict) throw new Error("STAFF_TIMETABLE_CONFLICT");
    }

    const updated = await this.repo.update(id, data);

    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: "UPDATE_TIMETABLE_ENTRY",
      entityType: "TIMETABLE",
      entityId: id,
      description: `Updated timetable entry ${id}`,
      oldValues: existing,
      newValues: data,
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
    });

    return updated;
  }

  async getTimetableStats(academicYearId?: string) {
    return await this.repo.getTimetableStats(academicYearId);
  }

  async getTodayTimetable(academicYearId?: string, classId?: string) {
    return await this.repo.getTodayTimetable(academicYearId, classId);
  }

  async deleteTimetableEntry(id: string, actor?: AuditActor) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new Error("TIMETABLE_NOT_FOUND");

    const result = await this.repo.delete(id);

    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: "DELETE_TIMETABLE_ENTRY",
      entityType: "TIMETABLE",
      entityId: id,
      description: `Deleted timetable entry ${id}`,
      oldValues: existing,
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
    });

    return result;
  }
}
