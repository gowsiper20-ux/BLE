import { Hono } from "hono";
import { SettingsService } from "../services/settings.service";
import { AuditService } from "../services/audit.service";
import { requireRole, requireStaffOrAdmin } from "../middlewares/auth.middleware";
import type { AuthPrincipal } from "@smart-attendance/shared";

export const settingsRoutes = new Hono();
const settingsService = new SettingsService();
const auditService = new AuditService();

// Any staff or administrator can view system settings
settingsRoutes.get("/", requireStaffOrAdmin, async (c) => {
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

// Only administrators can update system settings
settingsRoutes.put("/", requireRole('ADMIN'), async (c) => {
  try {
    const user = c.get("user") as AuthPrincipal;
    const body = await c.req.json();
    const updates = body.updates as { key: string; value: string }[];
    
    if (!updates || !Array.isArray(updates)) {
      return c.json({ success: false, error: { message: "Invalid updates payload" } }, 400);
    }

    const payload = updates.map(u => ({ ...u, updatedBy: user.id }));
    const results = await settingsService.updateSettings(payload);

    await auditService.log({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.roles[0] || 'ADMIN',
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
