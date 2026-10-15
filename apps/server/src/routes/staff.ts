import { Hono } from "hono";
import { StaffService } from "../services/staff.service";
import { TimetableRepository } from "../repositories/timetable.repository";

export const staffRoutes = new Hono();
const service = new StaffService();
const timetableRepo = new TimetableRepository();

staffRoutes.get("/", async (c) => {
  try {
    const search = c.req.query("search");
    const status = c.req.query("status");
    const role = c.req.query("role");
    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = parseInt(c.req.query("limit") || "20", 10);

    const data = await service.getStaff({ search, status, role, page, limit });
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

staffRoutes.get("/:id", async (c) => {
  try {
    const data = await service.getStaffById(c.req.param("id"));
    if (!data) return c.json({ success: false, error: { message: "Not found" } }, 404);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

staffRoutes.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.createStaff(body);
    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      return c.json({ success: false, error: { code: 'CONFLICT', message: error.message } }, 409);
    }
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.message } }, 400);
  }
});

staffRoutes.patch("/:id", async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.updateStaff(c.req.param("id"), body);
    return c.json({ success: true, data });
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      return c.json({ success: false, error: { code: 'CONFLICT', message: error.message } }, 409);
    }
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.message } }, 400);
  }
});

staffRoutes.patch("/:id/status", async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.updateStaffStatus(c.req.param("id"), body.status);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

staffRoutes.delete("/:id", async (c) => {
  try {
    await service.deleteStaff(c.req.param("id"));
    return c.json({ success: true });
  } catch (error: any) {
    // If it's a foreign key violation, we return a 409 Conflict with the specific message
    if (error.message.includes('dependent records')) {
      return c.json({ success: false, error: { message: error.message } }, 409);
    }
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

// --- Roles nested routes ---

staffRoutes.get("/:id/roles", async (c) => {
  try {
    const data = await service.getStaffRoles(c.req.param("id"));
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

staffRoutes.post("/:id/roles", async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.assignRole(c.req.param("id"), body.role);
    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

staffRoutes.delete("/:id/roles/:roleName", async (c) => {
  try {
    const data = await service.removeRole(c.req.param("id"), c.req.param("roleName"));
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

// --- Counselor Assignments (Nested) ---
staffRoutes.get("/:id/counselor-assignments", async (c) => {
  try {
    const data = await service.getCounselorAssignments({ staffId: c.req.param("id") });
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

staffRoutes.get("/:id/timetable", async (c) => {
  try {
    const data = await timetableRepo.findByStaff(c.req.param("id"));
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});
