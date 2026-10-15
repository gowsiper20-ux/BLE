import { Hono } from "hono";
import { StaffService } from "../services/staff.service";

export const counselorRoutes = new Hono();
const service = new StaffService();

counselorRoutes.get("/", async (c) => {
  try {
    const classId = c.req.query("classId");
    const academicYearId = c.req.query("academicYearId");
    const staffId = c.req.query("staffId");

    const data = await service.getCounselorAssignments({ classId, academicYearId, staffId });
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

counselorRoutes.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.assignCounselor(body);
    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      return c.json({ success: false, error: { code: 'CONFLICT', message: error.message } }, 409);
    }
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.message } }, 400);
  }
});

counselorRoutes.patch("/:id/status", async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.updateCounselorStatus(c.req.param("id"), body.status);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

counselorRoutes.delete("/:id", async (c) => {
  try {
    await service.deleteCounselorAssignment(c.req.param("id"));
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});
