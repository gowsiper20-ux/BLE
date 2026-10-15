import { ClassSubjectRepository } from "../repositories/class-subject.repository";
import { SubjectRepository } from "../repositories/subject.repository";
import { AcademicRepository } from "../repositories/academic.repository"; // Assuming we can resolve classes directly

export class ClassSubjectService {
  private repo: ClassSubjectRepository;
  private subjectRepo: SubjectRepository;
  private academicRepo: AcademicRepository;

  constructor() {
    this.repo = new ClassSubjectRepository();
    this.subjectRepo = new SubjectRepository();
    this.academicRepo = new AcademicRepository();
  }

  async getSubjectsByClass(classId: string, academicYearId?: string) {
    return await this.repo.getByClassId(classId, academicYearId);
  }

  async getClassesBySubject(subjectId: string, academicYearId?: string) {
    return await this.repo.getBySubjectId(subjectId, academicYearId);
  }

  async assignSubjectToClass(data: { classId: string; subjectId: string; academicYearId: string; status?: 'ACTIVE' | 'INACTIVE' }) {
    if (!data.classId || !data.subjectId || !data.academicYearId) {
      throw new Error("Missing required fields");
    }

    // Validation
    const exists = await this.repo.checkExists(data.classId, data.subjectId, data.academicYearId);
    if (exists) {
      throw new Error("DUPLICATE_CLASS_SUBJECT");
    }

    const subject = await this.subjectRepo.findById(data.subjectId);
    if (!subject) throw new Error("SUBJECT_NOT_FOUND");
    if (subject.status !== 'ACTIVE') throw new Error("SUBJECT_INACTIVE");

    const classData = await this.academicRepo.getClassById(data.classId);
    if (!classData) throw new Error("CLASS_NOT_FOUND");
    if (classData.status !== 'ACTIVE') throw new Error("CLASS_INACTIVE");

    if (subject.regulationId !== classData.regulationId) {
      throw new Error("REGULATION_MISMATCH");
    }

    if (subject.yearNumber !== classData.yearNumber) {
      throw new Error("YEAR_MISMATCH");
    }

    return await this.repo.create(data);
  }

  async updateAssignmentStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
    return await this.repo.updateStatus(id, status);
  }

  async removeAssignment(id: string) {
    // In reality, check if it's used in timetable. For MVP, we delete.
    await this.repo.delete(id);
  }
}
