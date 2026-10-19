import { Hono } from "hono";
import { AuditService } from "../services/audit.service";
import { requireHodOrAdmin } from "../middlewares/auth.middleware";

export const auditRoutes = new Hono();
const service = new AuditService();

// Audit logs viewable by ADMIN, HOD, and DEPUTY_HOD
auditRoutes.get("/logs", requireHodOrAdmin, async (c) => {
  try {
    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = parseInt(c.req.query("limit") || "25", 10);
    
    const params = {
      page,
      limit,
      search: c.req.query("search"),
      action: c.req.query("action"),
      entityType: c.req.query("entityType"),
      actorId: c.req.query("actorId"),
      dateFrom: c.req.query("dateFrom"),
      dateTo: c.req.query("dateTo"),
    };

    const data = await service.getLogs(params);
    return c.json({ success: true, ...data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});
