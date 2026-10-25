import { TimetableOverrideRepository } from "../repositories/timetable-override.repository";
import { TimetableRepository } from "../repositories/timetable.repository";
import { StaffRepository } from "../repositories/staff.repository";
import { AuditService } from "./audit.service";
import type { AuditActor } from "./staff.service";

export class TimetableOverrideService {
  private repo: TimetableOverrideRepository;
  private timetableRepo: TimetableRepository;
  private staffRepo: StaffRepository;
  private audit: AuditService;

  constructor() {
    this.repo = new TimetableOverrideRepository();
    this.timetableRepo = new TimetableRepository();
    this.staffRepo = new StaffRepository();
    this.audit = new AuditService();
  }

  async getOverrides() {
    return await this.repo.findAll();
  }

  async createOverride(data: any, actor?: AuditActor) {
    if (!data.timetableId || !data.overrideDate) {
      throw new Error("Missing required fields: timetableId and overrideDate");
    }

    const timetable = await this.timetableRepo.findById(data.timetableId);
    if (!timetable) throw new Error("TIMETABLE_NOT_FOUND");

    const existing = await this.repo.findByTimetableAndDate(data.timetableId, data.overrideDate);
    if (existing && existing.status === "ACTIVE") {
      throw new Error("OVERRIDE_ALREADY_EXISTS");
    }

    if (data.replacementStaffId) {
      const staffMember = await this.staffRepo.getStaffById(data.replacementStaffId);
      if (!staffMember) throw new Error("STAFF_NOT_FOUND");
      if (staffMember.status !== "ACTIVE") throw new Error("STAFF_INACTIVE");
    }

    const override = await this.repo.create(data);

    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: "CREATE_TIMETABLE_OVERRIDE",
      entityType: "TIMETABLE_OVERRIDE",
      entityId: override.id,
      description: `Created timetable override for date ${data.overrideDate} on timetable ${data.timetableId}`,
      newValues: data,
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
    });

    return override;
  }

  async updateOverride(id: string, data: any, actor?: AuditActor) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new Error("OVERRIDE_NOT_FOUND");

    const updated = await this.repo.update(id, data);

    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: "UPDATE_TIMETABLE_OVERRIDE",
      entityType: "TIMETABLE_OVERRIDE",
      entityId: id,
      description: `Updated timetable override ${id}`,
      oldValues: existing,
      newValues: data,
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
    });

    return updated;
  }

  async deleteOverride(id: string, actor?: AuditActor) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new Error("OVERRIDE_NOT_FOUND");

    const result = await this.repo.delete(id);

    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: "DELETE_TIMETABLE_OVERRIDE",
      entityType: "TIMETABLE_OVERRIDE",
      entityId: id,
      description: `Deleted timetable override ${id}`,
      oldValues: existing,
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
    });

    return result;
  }
}
