import { AcademicRepository } from '../repositories/academic.repository';
import { academicYears, batches, regulations, classes } from '../db/schema/academic';

export class AcademicService {
  private repo: AcademicRepository;

  constructor() {
    this.repo = new AcademicRepository();
  }

  // --- Departments ---
  async getDepartments() {
    return this.repo.getDepartments();
  }

  // --- Academic Years ---
  async getAcademicYears() {
    return this.repo.getAcademicYears();
  }

  async getAcademicYearById(id: string) {
    return this.repo.getAcademicYearById(id);
  }

  async createAcademicYear(data: typeof academicYears.$inferInsert) {
    // Check start vs end dates
    if (new Date(data.startDate) >= new Date(data.endDate)) {
      throw new Error('Start date must be before end date.');
    }

    // Check duplicate name
    const existing = await this.repo.getAcademicYearByName(data.name);
    if (existing) {
      throw new Error('Academic year with this name already exists.');
    }

    // If marked current, ensure no other is current
    if (data.isCurrent) {
      const current = await this.repo.getCurrentAcademicYear();
      if (current) {
        await this.repo.updateAcademicYear(current.id, { isCurrent: false });
      }
    }

    const [created] = await this.repo.createAcademicYear(data);
    return created;
  }

  async updateAcademicYear(id: string, data: Partial<typeof academicYears.$inferInsert>) {
    if (data.name) {
      const existing = await this.repo.getAcademicYearByName(data.name);
      if (existing && existing.id !== id) {
        throw new Error('Academic year with this name already exists.');
      }
    }

    if (data.startDate && data.endDate) {
      if (new Date(data.startDate) >= new Date(data.endDate)) {
        throw new Error('Start date must be before end date.');
      }
    }

    if (data.isCurrent) {
      const current = await this.repo.getCurrentAcademicYear();
      if (current && current.id !== id) {
        await this.repo.updateAcademicYear(current.id, { isCurrent: false });
      }
    }

    const [updated] = await this.repo.updateAcademicYear(id, data);
    return updated;
  }

  async deleteAcademicYear(id: string) {
    // Ideally check references here before deleting. For now, try deleting and DB constraints will throw.
    const [deleted] = await this.repo.deleteAcademicYear(id);
    return deleted;
  }

  // --- Batches ---
  async getBatches() {
    return this.repo.getBatches();
  }

  async getBatchById(id: string) {
    return this.repo.getBatchById(id);
  }

  async createBatch(data: typeof batches.$inferInsert) {
    if (data.startYear >= data.endYear) {
      throw new Error('Start year must be less than end year.');
    }
    
    const existing = await this.repo.getBatchByNameAndDept(data.name, data.departmentId);
    if (existing) {
      throw new Error('Batch with this name already exists in this department.');
    }

    const [created] = await this.repo.createBatch(data);
    return created;
  }

  async updateBatch(id: string, data: Partial<typeof batches.$inferInsert>) {
    const existingBatch = await this.repo.getBatchById(id);
    if (!existingBatch) throw new Error('Batch not found');

    const name = data.name || existingBatch.name;
    const deptId = data.departmentId || existingBatch.departmentId;

    if (data.name || data.departmentId) {
      const existing = await this.repo.getBatchByNameAndDept(name, deptId);
      if (existing && existing.id !== id) {
        throw new Error('Batch with this name already exists in this department.');
      }
    }

    const startYear = data.startYear || existingBatch.startYear;
    const endYear = data.endYear || existingBatch.endYear;
    if (startYear >= endYear) {
      throw new Error('Start year must be less than end year.');
    }

    const [updated] = await this.repo.updateBatch(id, data);
    return updated;
  }

  async deleteBatch(id: string) {
    const [deleted] = await this.repo.deleteBatch(id);
    return deleted;
  }

  // --- Regulations ---
  async getRegulations() {
    return this.repo.getRegulations();
  }
  
  async getRegulationById(id: string) {
    return this.repo.getRegulationById(id);
  }

  async createRegulation(data: typeof regulations.$inferInsert) {
    const [created] = await this.repo.createRegulation(data);
    return created;
  }

  async updateRegulation(id: string, data: Partial<typeof regulations.$inferInsert>) {
    const [updated] = await this.repo.updateRegulation(id, data);
    return updated;
  }

  async deleteRegulation(id: string) {
    const [deleted] = await this.repo.deleteRegulation(id);
    return deleted;
  }

  // --- Classes ---
  async getClasses() {
    return this.repo.getClasses();
  }

  async getClassById(id: string) {
    return this.repo.getClassById(id);
  }

  async createClass(data: typeof classes.$inferInsert) {
    if (data.yearNumber < 1 || data.yearNumber > 4) {
      throw new Error('Year number must be between 1 and 4.');
    }

    if (!data.section || data.section.trim() === '') {
      throw new Error('Section cannot be empty.');
    }

    const existing = await this.repo.getClassByUniqueConstraint(
      data.departmentId,
      data.academicYearId,
      data.yearNumber,
      data.section
    );

    if (existing) {
      throw new Error('Class with this department, academic year, year number, and section already exists.');
    }

    const [created] = await this.repo.createClass(data);
    return created;
  }

  async updateClass(id: string, data: Partial<typeof classes.$inferInsert>) {
    const existingCls = await this.repo.getClassById(id);
    if (!existingCls) throw new Error('Class not found');

    const yearNumber = data.yearNumber || existingCls.yearNumber;
    const section = data.section || existingCls.section;
    const deptId = data.departmentId || existingCls.departmentId;
    const acYearId = data.academicYearId || existingCls.academicYearId;

    if (data.yearNumber || data.section || data.departmentId || data.academicYearId) {
       const existing = await this.repo.getClassByUniqueConstraint(deptId, acYearId, yearNumber, section);
       if (existing && existing.id !== id) {
         throw new Error('Class with this department, academic year, year number, and section already exists.');
       }
    }

    if (yearNumber < 1 || yearNumber > 4) {
      throw new Error('Year number must be between 1 and 4.');
    }

    const [updated] = await this.repo.updateClass(id, data);
    return updated;
  }

  async deleteClass(id: string) {
    const [deleted] = await this.repo.deleteClass(id);
    return deleted;
  }
}
