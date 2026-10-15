import { TimetableRepository } from "../repositories/timetable.repository";
import { ClassSubjectRepository } from "../repositories/class-subject.repository";
import { StaffRepository } from "../repositories/staff.repository";

export class TimetableService {
  private repo: TimetableRepository;
  private classSubjectRepo: ClassSubjectRepository;
  private staffRepo: StaffRepository;

  constructor() {
    this.repo = new TimetableRepository();
    this.classSubjectRepo = new ClassSubjectRepository();
    this.staffRepo = new StaffRepository();
  }

  async getTimetableByClass(classId: string, academicYearId?: string) {
    return await this.repo.findByClass(classId, academicYearId);
  }

  async getTimetableByStaff(staffId: string, academicYearId?: string) {
    return await this.repo.findByStaff(staffId, academicYearId);
  }

  async createTimetableEntry(data: any) {
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


    return await this.repo.create(data);
  }

  async updateTimetableEntry(id: string, data: any) {
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


    return await this.repo.update(id, data);
  }

  async deleteTimetableEntry(id: string) {
    return await this.repo.delete(id);
  }
}
