import { SubjectRepository } from "../repositories/subject.repository";
import { AcademicRepository } from "../repositories/academic.repository";
import { AuditService } from "./audit.service";
import type { AuditActor } from "./staff.service";
import { SubjectType, subjectTypes } from "../db/schema/subjects";
import { parseTabularImport } from "./tabular-import";
import type { Buffer } from "node:buffer";

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

  async validateImportFile(fileBuffer: Buffer, fileName: string) {
    const rows = parseTabularImport(fileBuffer, fileName, {
      code: 'code',
      subject_code: 'code',
      course_code: 'code',
      name: 'name',
      subject_name: 'name',
      course_name: 'name',
      title: 'name',
      subject_type: 'subject_type',
      type: 'subject_type',
      course_type: 'subject_type',
      year_number: 'year_number',
      year: 'year_number',
      year_of_study: 'year_number',
      regulation_code: 'regulation_code',
      regulation: 'regulation_code',
      regulation_name: 'regulation_code',
      description: 'description',
      desc: 'description',
    }, ['code', 'name', 'subject_type', 'year_number']);

    const regulationsList = await this.academicRepo.getRegulations();
    const defaultRegulation = regulationsList.find(r => r.name === 'R2023') || regulationsList[0];

    const codeCounts = new Map<string, number>();
    for (const row of rows) {
      const code = (row.code || '').trim().toUpperCase();
      if (code) codeCounts.set(code, (codeCounts.get(code) || 0) + 1);
    }

    const data = await Promise.all(rows.map(async (row, index) => {
      const rowNumber = index + 2;
      const code = (row.code || '').trim().toUpperCase();
      const name = (row.name || '').trim();
      const rawType = (row.subject_type || '').trim().toUpperCase();
      const rawYear = parseInt((row.year_number || '').trim(), 10);
      const regCode = (row.regulation_code || '').trim();
      const description = (row.description || '').trim() || undefined;

      const errors: { code: string; message: string }[] = [];

      if (!code) errors.push({ code: 'MISSING_CODE', message: 'Subject code is required.' });
      else if (code.length < 2 || code.length > 50) errors.push({ code: 'INVALID_CODE', message: 'Subject code must be 2-50 characters.' });
      else if ((codeCounts.get(code) || 0) > 1) errors.push({ code: 'DUPLICATE_CODE_IN_FILE', message: 'Duplicate subject code within the import file.' });

      if (!name) errors.push({ code: 'MISSING_NAME', message: 'Subject name is required.' });
      else if (name.length < 3 || name.length > 255) errors.push({ code: 'INVALID_NAME', message: 'Subject name must be 3-255 characters.' });

      if (!rawType || !subjectTypes.includes(rawType as any)) {
        errors.push({ code: 'INVALID_TYPE', message: `Type must be one of: ${subjectTypes.join(', ')}.` });
      }

      if (isNaN(rawYear) || rawYear < 1 || rawYear > 4) {
        errors.push({ code: 'INVALID_YEAR', message: 'Year must be a number between 1 and 4.' });
      }

      let matchedRegulation = defaultRegulation;
      if (regCode) {
        const found = regulationsList.find(r => r.name.toLowerCase() === regCode.toLowerCase());
        if (found) {
          matchedRegulation = found;
        } else {
          errors.push({ code: 'REGULATION_NOT_FOUND', message: `Regulation "${regCode}" not found.` });
        }
      }

      if (code && errors.length === 0) {
        const existing = await this.repo.findByCode(code);
        if (existing) {
          errors.push({ code: 'DUPLICATE_CODE', message: `Subject code "${code}" already exists in the system.` });
        }
      }

      return {
        rowNumber,
        code,
        name,
        subjectType: rawType as SubjectType,
        yearNumber: rawYear,
        regulationId: matchedRegulation?.id,
        regulationName: matchedRegulation?.name,
        description,
        isValid: errors.length === 0,
        errors,
      };
    }));

    return {
      totalRows: data.length,
      valid: data.filter(d => d.isValid).length,
      errors: data.filter(d => !d.isValid).length,
      data,
    };
  }

  async confirmImport(fileBuffer: Buffer, fileName: string, actor?: AuditActor) {
    const preview = await this.validateImportFile(fileBuffer, fileName);
    const candidates = preview.data.filter(d => d.isValid);

    const createdRows: any[] = [];
    for (const c of candidates) {
      try {
        const created = await this.repo.create({
          code: c.code,
          name: c.name,
          subjectType: c.subjectType,
          yearNumber: c.yearNumber,
          regulationId: c.regulationId,
          description: c.description || null,
          status: 'ACTIVE',
          dataSource: 'MANUALLY_ENTERED',
        });
        createdRows.push(created);
      } catch {
        // Ignored duplicate or conflict
      }
    }

    const created = createdRows.length;
    const skipped = preview.totalRows - created;

    if (actor) {
      await this.audit.log({
        actorId: actor.actorId,
        actorName: actor.actorName,
        actorRole: actor.actorRole,
        action: 'BULK_IMPORT_SUBJECTS',
        entityType: 'SUBJECT',
        description: `Bulk imported ${created} subjects (${skipped} skipped/failed).`,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      });
    }

    return {
      total: preview.totalRows,
      created,
      skipped,
      failed: preview.errors,
      rows: preview.data.map(d => ({
        rowNumber: d.rowNumber,
        status: d.isValid ? 'created' : 'skipped',
        errors: d.errors,
      })),
    };
  }
}
