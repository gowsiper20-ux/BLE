import { SubjectRepository } from "../repositories/subject.repository";

export class SubjectService {
  private repo: SubjectRepository;

  constructor() {
    this.repo = new SubjectRepository();
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

  async createSubject(data: any) {
    if (!data.code || !data.name || !data.subjectType || !data.yearNumber || !data.regulationId) {
      throw new Error("Missing required fields");
    }

    const existing = await this.repo.findByCode(data.code);
    if (existing) {
      throw new Error("DUPLICATE_SUBJECT_CODE");
    }

    return await this.repo.create(data);
  }

  async updateSubject(id: string, data: any) {
    const subject = await this.repo.findById(id);
    if (!subject) throw new Error("SUBJECT_NOT_FOUND");
    return await this.repo.update(id, data);
  }

  async updateSubjectStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
    const subject = await this.repo.findById(id);
    if (!subject) throw new Error("SUBJECT_NOT_FOUND");
    return await this.repo.update(id, { status });
  }

  async deleteSubject(id: string) {
    // Check if referenced in classSubjects? For MVP, we'll allow deactivate instead.
    // Real implementation would check dependencies before physical delete.
    const subject = await this.repo.findById(id);
    if (!subject) throw new Error("SUBJECT_NOT_FOUND");
    
    // Instead of deleting, we enforce status deactivation from the frontend, but here is physical delete if forced.
    await this.repo.delete(id);
  }
}
