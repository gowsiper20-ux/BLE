import { PeriodRepository } from "../repositories/period.repository";

export class PeriodService {
  private repo: PeriodRepository;

  constructor() {
    this.repo = new PeriodRepository();
  }

  async getPeriods() {
    return await this.repo.findAll();
  }

  async getPeriodById(id: string) {
    return await this.repo.findById(id);
  }

  async createPeriod(data: any) {
    if (!data.periodNumber || !data.name || !data.startTime || !data.endTime) {
      throw new Error("Missing required fields");
    }
    // Assume validation passes
    return await this.repo.create(data);
  }

  async updatePeriod(id: string, data: any) {
    return await this.repo.update(id, data);
  }

  async deletePeriod(id: string) {
    return await this.repo.delete(id);
  }
}
