import { db } from '../db';
import { systemSettings } from '../db/schema/settings';
import { eq, inArray } from 'drizzle-orm';

export class SettingsService {
  async getAllSettings() {
    return await db.select().from(systemSettings);
  }

  async getSettingsByCategory(category: string) {
    return await db.select().from(systemSettings).where(eq(systemSettings.category, category));
  }

  async updateSettings(updates: { key: string; value: string; updatedBy?: string }[]) {
    // We do this in a transaction or individual updates
    const results = [];
    for (const update of updates) {
      const [res] = await db.update(systemSettings)
        .set({ 
          value: update.value, 
          updatedBy: update.updatedBy,
          updatedAt: new Date()
        })
        .where(eq(systemSettings.key, update.key))
        .returning();
      if (res) results.push(res);
    }
    return results;
  }
}
