import { TimetableOverrideRepository } from "../repositories/timetable-override.repository";
import { TimetableRepository } from "../repositories/timetable.repository";
import { StaffRepository } from "../repositories/staff.repository";

export class TimetableOverrideService {
  private repo: TimetableOverrideRepository;
  private timetableRepo: TimetableRepository;
  private staffRepo: StaffRepository;

  constructor() {
    this.repo = new TimetableOverrideRepository();
    this.timetableRepo = new TimetableRepository();
    this.staffRepo = new StaffRepository();
  }

  async getOverrides() {
    return await this.repo.findAll();
  }

  async createOverride(data: any) {
    if (!data.timetableId || !data.overrideDate) {
      throw new Error("Missing required fields");
    }

    const timetable = await this.timetableRepo.findById(data.timetableId);
    if (!timetable) throw new Error("TIMETABLE_NOT_FOUND");

    if (data.replacementStaffId) {
      const staffMember = await this.staffRepo.getStaffById(data.replacementStaffId);
      if (!staffMember) throw new Error("STAFF_NOT_FOUND");
      if (staffMember.status !== 'ACTIVE') throw new Error("STAFF_INACTIVE");
      
      // Ideally check staff override conflict for that date, but MVP simplifies
    }

    return await this.repo.create(data);
  }

  async updateOverride(id: string, data: any) {
    return await this.repo.update(id, data);
  }

  async deleteOverride(id: string) {
    return await this.repo.delete(id);
  }
}
