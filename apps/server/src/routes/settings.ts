import { Hono } from "hono";
import { SettingsService } from "../services/settings.service";
import { AuditService } from "../services/audit.service";

export const settingsRoutes = new Hono();
const settingsService = new SettingsService();
const auditService = new AuditService();

settingsRoutes.get("/", async (c) => {
  try {
    const category = c.req.query("category");
    const settings = category 
      ? await settingsService.getSettingsByCategory(category)
      : await settingsService.getAllSettings();
    
    // Convert array to object map
    const mapped = settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as Record<string, string>);
    
    return c.json({ success: true, data: mapped, raw: settings });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

settingsRoutes.put("/", async (c) => {
  try {
    const body = await c.req.json();
    const updates = body.updates as { key: string; value: string }[];
    // Mock user for now
    const staffId = "00000000-0000-0000-0000-000000000000"; // Should come from JWT
    
    if (!updates || !Array.isArray(updates)) {
      return c.json({ success: false, error: { message: "Invalid updates payload" } }, 400);
    }

    const payload = updates.map(u => ({ ...u, updatedBy: undefined }));
    
    const results = await settingsService.updateSettings(payload);

    await auditService.log({
      action: 'UPDATE',
      entityType: 'SETTINGS',
      description: `Updated ${results.length} system settings`,
      newValues: { updates }
    });

    return c.json({ success: true, data: results });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});
