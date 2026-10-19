import { ClassSubjectRepository } from "../repositories/class-subject.repository";
import { SubjectRepository } from "../repositories/subject.repository";
import { AcademicRepository } from "../repositories/academic.repository";
import { AuditService } from "./audit.service";
import type { AuditActor } from "./staff.service";

export class ClassSubjectService {
  private repo: ClassSubjectRepository;
  private subjectRepo: SubjectRepository;
  private academicRepo: AcademicRepository;
  private audit: AuditService;

  constructor() {
    this.repo = new ClassSubjectRepository();
    this.subjectRepo = new SubjectRepository();
    this.academicRepo = new AcademicRepository();
    this.audit = new AuditService();
  }

  async getSubjectsByClass(classId: string, academicYearId?: string) {
    return await this.repo.getByClassId(classId, academicYearId);
  }

  async getClassesBySubject(subjectId: string, academicYearId?: string) {
    return await this.repo.getBySubjectId(subjectId, academicYearId);
  }

  async assignSubjectToClass(data: { classId: string; subjectId: string; academicYearId: string; status?: 'ACTIVE' | 'INACTIVE' }, actor?: AuditActor) {
    if (!data.classId || typeof data.classId !== 'string') {
      throw new Error("Class ID is required.");
    }
    if (!data.subjectId || typeof data.subjectId !== 'string') {
      throw new Error("Subject ID is required.");
    }
    if (!data.academicYearId || typeof data.academicYearId !== 'string') {
      throw new Error("Academic Year ID is required.");
    }

    const exists = await this.repo.checkExists(data.classId, data.subjectId, data.academicYearId);
    if (exists) {
      throw new Error("This subject is already assigned to this class for the selected academic year.");
    }

    const subject = await this.subjectRepo.findById(data.subjectId);
    if (!subject) throw new Error("Subject not found.");
    if (subject.status !== 'ACTIVE') throw new Error("Cannot assign inactive subject to class.");

    const classData = await this.academicRepo.getClassById(data.classId);
    if (!classData) throw new Error("Class not found.");
    if (classData.status !== 'ACTIVE') throw new Error("Cannot assign subject to inactive class.");

    const yearData = await this.academicRepo.getAcademicYearById(data.academicYearId);
    if (!yearData) throw new Error("Academic year not found.");

    if (subject.regulationId !== classData.regulationId) {
      throw new Error("Regulation mismatch: Subject regulation does not match class regulation.");
    }

    if (subject.yearNumber !== classData.yearNumber) {
      throw new Error(`Year mismatch: Subject year (${subject.yearNumber}) does not match class year (${classData.yearNumber}).`);
    }

    const result = await this.repo.create({
      classId: data.classId,
      subjectId: data.subjectId,
      academicYearId: data.academicYearId,
      status: data.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    });

    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: 'ASSIGN_CLASS_SUBJECT',
      entityType: 'CLASS_SUBJECT',
      entityId: result.id,
      description: `Assigned subject '${subject.code}' to class '${classData.name}'`,
      newValues: {
        classId: data.classId,
        className: classData.name,
        subjectId: data.subjectId,
        subjectCode: subject.code,
        academicYearId: data.academicYearId,
        academicYear: yearData.name,
      },
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent
    });

    return result;
  }

  async updateAssignmentStatus(id: string, status: 'ACTIVE' | 'INACTIVE', actor?: AuditActor) {
    const classSubject = await this.repo.findById(id);
    if (!classSubject) throw new Error("Class-subject assignment not found.");

    if (status !== 'ACTIVE' && status !== 'INACTIVE') {
      throw new Error("Status must be ACTIVE or INACTIVE.");
    }

    const result = await this.repo.updateStatus(id, status);

    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: 'UPDATE_CLASS_SUBJECT_STATUS',
      entityType: 'CLASS_SUBJECT',
      entityId: id,
      description: `Updated class-subject assignment for '${classSubject.subjectCode}' in '${classSubject.className}' to ${status}`,
      oldValues: { status: classSubject.status },
      newValues: { status },
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent
    });

    return result;
  }

  async removeAssignment(id: string, actor?: AuditActor) {
    const ref = await this.repo.getClassSubjectReferenceCounts(id);
    if (!ref || !ref.classSubject) throw new Error("Class-subject assignment not found.");

    if (ref.timetableCount > 0) {
      throw new Error(`Cannot remove subject from class: ${ref.timetableCount} timetable schedule(s) are assigned to this class and subject.`);
    }

    await this.repo.delete(id);

    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: 'REMOVE_CLASS_SUBJECT',
      entityType: 'CLASS_SUBJECT',
      entityId: id,
      description: `Removed subject '${ref.classSubject.subjectCode}' from class '${ref.classSubject.className}'`,
      oldValues: ref.classSubject,
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent
    });
  }
}
