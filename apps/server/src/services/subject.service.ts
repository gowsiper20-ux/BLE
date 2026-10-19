import { SubjectRepository } from "../repositories/subject.repository";
import { AcademicRepository } from "../repositories/academic.repository";
import { AuditService } from "./audit.service";
import type { AuditActor } from "./staff.service";
import { SubjectType, subjectTypes } from "../db/schema/subjects";

export class SubjectService {
  private repo: SubjectRepository;
  private academicRepo: AcademicRepository;
  private audit: AuditService;

  constructor() {
    this.repo = new SubjectRepository();
    this.academicRepo = new AcademicRepository();
    this.audit = new AuditService();
  }

  private validateSubjectCode(code?: string): string {
    if (!code || typeof code !== 'string' || !code.trim()) {
      throw new Error("Subject code is required.");
    }
    const clean = code.trim().toUpperCase();
    if (clean.length < 2 || clean.length > 50) {
      throw new Error("Subject code must be between 2 and 50 characters.");
    }
    return clean;
  }

  private validateSubjectName(name?: string): string {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new Error("Subject name is required.");
    }
    const clean = name.trim();
    if (clean.length < 3 || clean.length > 255) {
      throw new Error("Subject name must be between 3 and 255 characters.");
    }
    return clean;
  }

  private validateSubjectType(type?: string): SubjectType {
    if (!type || !subjectTypes.includes(type as any)) {
      throw new Error(`Subject type must be one of: ${subjectTypes.join(', ')}`);
    }
    return type as SubjectType;
  }

  private validateYearNumber(year?: number | string): number {
    const yr = typeof year === 'string' ? parseInt(year, 10) : year;
    if (!yr || isNaN(yr) || yr < 1 || yr > 4) {
      throw new Error("Year number must be an integer between 1 and 4.");
    }
    return yr;
  }

  async getSubjects(params: { search?: string; type?: string; year?: number; regulationId?: string; status?: string; page?: number; limit?: number }) {
    const limit = params.limit || 20;
    const page = params.page || 1;
    const offset = (page - 1) * limit;

    const result = await this.repo.findSubjects({
      search: params.search,
      type: params.type,
      year: params.year,
      regulationId: params.regulationId,
      status: params.status,
      limit,
      offset
    });

    return {
      subjects: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit)
      }
    };
  }

  async getSubjectById(id: string) {
    return await this.repo.findById(id);
  }

  async createSubject(data: any, actor?: AuditActor) {
    const cleanCode = this.validateSubjectCode(data.code);
    const cleanName = this.validateSubjectName(data.name);
    const subjectType = this.validateSubjectType(data.subjectType);
    const yearNumber = this.validateYearNumber(data.yearNumber);

    if (!data.regulationId || typeof data.regulationId !== 'string') {
      throw new Error("Regulation ID is required.");
    }

    const regulation = await this.academicRepo.getRegulationById(data.regulationId);
    if (!regulation) {
      throw new Error("Regulation not found.");
    }

    const existing = await this.repo.findByCode(cleanCode);
    if (existing) {
      if (existing.dataSource !== 'LEGACY_UNVERIFIED') {
        throw new Error(`Subject code '${cleanCode}' already exists.`);
      }

      const references = await this.repo.getSubjectReferenceCounts(existing.id);
      if (references.total > 0) {
        throw new Error(
          `Subject code '${cleanCode}' belongs to an unverified legacy row referenced by timetable/history data. It was preserved and cannot be overwritten; use a different code or review the record separately.`,
        );
      }

      const result = await this.repo.update(existing.id, {
        code: cleanCode,
        name: cleanName,
        description: data.description?.trim() || null,
        subjectType,
        yearNumber,
        regulationId: data.regulationId,
        status: data.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        dataSource: 'MANUALLY_ENTERED',
      });

      await this.audit.log({
        actorId: actor?.actorId,
        actorName: actor?.actorName,
        actorRole: actor?.actorRole,
        action: 'VERIFY_SUBJECT',
        entityType: 'SUBJECT',
        entityId: result.id,
        description: `Re-entered unreferenced legacy subject '${result.code} - ${result.name}' as manual data`,
        oldValues: existing,
        newValues: result,
        ipAddress: actor?.ipAddress,
        userAgent: actor?.userAgent,
      });
      return result;
    }

    const payload = {
      code: cleanCode,
      name: cleanName,
      description: data.description?.trim() || null,
      subjectType,
      yearNumber,
      regulationId: data.regulationId,
      status: data.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      dataSource: 'MANUALLY_ENTERED' as const,
    };

    const result = await this.repo.create(payload);

    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: 'CREATE_SUBJECT',
      entityType: 'SUBJECT',
      entityId: result.id,
      description: `Created subject '${result.code} - ${result.name}' (${result.subjectType})`,
      newValues: result,
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent
    });

    return result;
  }

  async updateSubject(id: string, data: any, actor?: AuditActor) {
    const subject = await this.repo.findById(id);
    if (!subject) throw new Error("Subject not found.");
    if (subject.dataSource !== 'MANUALLY_ENTERED') {
      throw new Error("Legacy unverified subjects cannot be edited because they may be referenced by historical timetable or attendance data.");
    }

    const updatePayload: any = {};

    if (data.code !== undefined) {
      const cleanCode = this.validateSubjectCode(data.code);
      if (cleanCode.toLowerCase() !== subject.code.toLowerCase()) {
        const existing = await this.repo.findByCode(cleanCode);
        if (existing && existing.id !== id) {
          throw new Error(`Subject code '${cleanCode}' already exists.`);
        }
      }
      updatePayload.code = cleanCode;
    }

    if (data.name !== undefined) {
      updatePayload.name = this.validateSubjectName(data.name);
    }

    if (data.description !== undefined) {
      updatePayload.description = data.description ? data.description.trim() : null;
    }

    if (data.subjectType !== undefined) {
      updatePayload.subjectType = this.validateSubjectType(data.subjectType);
    }

    if (data.yearNumber !== undefined) {
      updatePayload.yearNumber = this.validateYearNumber(data.yearNumber);
    }

    if (data.regulationId !== undefined) {
      const regulation = await this.academicRepo.getRegulationById(data.regulationId);
      if (!regulation) {
        throw new Error("Regulation not found.");
      }
      updatePayload.regulationId = data.regulationId;
    }

    if (data.status !== undefined) {
      if (data.status !== 'ACTIVE' && data.status !== 'INACTIVE') {
        throw new Error("Status must be ACTIVE or INACTIVE.");
      }
      updatePayload.status = data.status;
    }

    const result = await this.repo.update(id, updatePayload);

    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: 'UPDATE_SUBJECT',
      entityType: 'SUBJECT',
      entityId: id,
      description: `Updated subject '${subject.code}'`,
      oldValues: subject,
      newValues: result,
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent
    });

    return result;
  }

  async updateSubjectStatus(id: string, status: 'ACTIVE' | 'INACTIVE', actor?: AuditActor) {
    const subject = await this.repo.findById(id);
    if (!subject) throw new Error("Subject not found.");
    if (subject.dataSource !== 'MANUALLY_ENTERED') {
      throw new Error("Legacy unverified subjects cannot be changed or deleted.");
    }

    if (status !== 'ACTIVE' && status !== 'INACTIVE') {
      throw new Error("Status must be ACTIVE or INACTIVE.");
    }

    const result = await this.repo.update(id, { status });

    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: 'UPDATE_SUBJECT_STATUS',
      entityType: 'SUBJECT',
      entityId: id,
      description: `Updated subject '${subject.code}' status to ${status}`,
      oldValues: { status: subject.status },
      newValues: { status },
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent
    });

    return result;
  }

  async deleteSubject(id: string, actor?: AuditActor) {
    const subject = await this.repo.findById(id);
    if (!subject) throw new Error("Subject not found.");
    if (subject.dataSource !== 'MANUALLY_ENTERED') {
      throw new Error("Legacy unverified subjects cannot be changed or deleted.");
    }
    
    const counts = await this.repo.getSubjectReferenceCounts(id);
    if (counts.total > 0) {
      const details: string[] = [];
      if (counts.classSubjectCount > 0) details.push(`${counts.classSubjectCount} class mapping(s)`);
      if (counts.timetableCount > 0) details.push(`${counts.timetableCount} timetable schedule(s)`);
      if (counts.overrideCount > 0) details.push(`${counts.overrideCount} timetable override(s)`);
      throw new Error(`Cannot delete subject '${subject.code}': it is referenced by ${details.join(' and ')}. Consider deactivating the subject instead.`);
    }

    await this.repo.delete(id);

    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: 'DELETE_SUBJECT',
      entityType: 'SUBJECT',
      entityId: id,
      description: `Deleted subject '${subject.code} - ${subject.name}'`,
      oldValues: subject,
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent
    });
  }
}
