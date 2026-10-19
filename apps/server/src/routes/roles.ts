import { Hono } from "hono";
import { StaffService } from "../services/staff.service";
import { requireStaffOrAdmin } from "../middlewares/auth.middleware";

export const roleRoutes = new Hono();
const service = new StaffService();

roleRoutes.get("/", requireStaffOrAdmin, async (c) => {
  try {
    const data = await service.getRoles();
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});
