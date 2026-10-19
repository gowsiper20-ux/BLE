import { Hono } from "hono";
import { StaffService } from "../services/staff.service";
import { TimetableRepository } from "../repositories/timetable.repository";
import { requireRole, requireStaffOrAdmin, requireHodOrAdmin } from "../middlewares/auth.middleware";
import type { AuthPrincipal } from "@smart-attendance/shared";

export const staffRoutes = new Hono();
const service = new StaffService();
const timetableRepo = new TimetableRepository();

function getActorFromContext(c: any) {
  const user = c.get('user') as AuthPrincipal | undefined;
  return {
    actorId: user?.id,
    actorName: user?.name || user?.collegeEmail || 'System User',
    actorRole: user?.roles?.[0] || 'ADMIN',
    ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || '127.0.0.1',
    userAgent: c.req.header('user-agent'),
  };
}

function handleStaffError(c: any, error: any) {
  const msg = error?.message || 'An unexpected error occurred.';
  if (
    msg.includes('already exists') ||
    msg.includes('Cannot delete') ||
    msg.includes('Cannot deactivate') ||
    msg.includes('Cannot remove ADMIN role') ||
    msg.includes('associated with this staff member')
  ) {
    return c.json({ success: false, error: { code: 'CONFLICT', message: msg } }, 409);
  }
  if (
    msg.includes('not found') ||
    msg.includes('Not found') ||
    msg.includes('invalid input syntax for type uuid')
  ) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: msg } }, 404);
  }
  if (
    msg.includes('required') ||
    msg.includes('must belong to') ||
    msg.includes('Invalid') ||
    msg.includes('must be')
  ) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: msg } }, 400);
  }
  return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: msg } }, 500);
}

// Listing staff: ADMIN, HOD, and DEPUTY_HOD can view all staff
staffRoutes.get("/", requireHodOrAdmin, async (c) => {
  try {
    const search = c.req.query("search");
    const status = c.req.query("status");
    const role = c.req.query("role");
    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = parseInt(c.req.query("limit") || "20", 10);

    const data = await service.getStaff({ search, status, role, page, limit });
    return c.json({ success: true, data });
  } catch (error: any) {
    return handleStaffError(c, error);
  }
});

// Single staff details: Any staff can view own profile; ADMIN/HOD can view any
staffRoutes.get("/:id", requireStaffOrAdmin, async (c) => {
  try {
    const user = c.get("user") as AuthPrincipal;
    const targetId = c.req.param("id")!;

    const isSelf = user.id === targetId;
    const isLeadership = user.roles.some((r: string) => ["ADMIN", "HOD", "DEPUTY_HOD"].includes(r));

    if (!isSelf && !isLeadership) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: "Forbidden: You may only view your own profile." } }, 403);
    }

    const data = await service.getStaffById(targetId);
    if (!data) return c.json({ success: false, error: { code: 'NOT_FOUND', message: "Staff not found" } }, 404);
    return c.json({ success: true, data });
  } catch (error: any) {
    return handleStaffError(c, error);
  }
});

// Creating new staff: ADMIN only
staffRoutes.post("/", requireRole("ADMIN"), async (c) => {
  try {
    const actor = getActorFromContext(c);
    const body = await c.req.json();
    const data = await service.createStaff(body, actor);
    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    return handleStaffError(c, error);
  }
});

// Updating staff: ADMIN only
staffRoutes.patch("/:id", requireRole("ADMIN"), async (c) => {
  try {
    const actor = getActorFromContext(c);
    const body = await c.req.json();
    const data = await service.updateStaff(c.req.param("id")!, body, actor);
    return c.json({ success: true, data });
  } catch (error: any) {
    return handleStaffError(c, error);
  }
});

// Changing staff active status: ADMIN only
staffRoutes.patch("/:id/status", requireRole("ADMIN"), async (c) => {
  try {
    const actor = getActorFromContext(c);
    const body = await c.req.json();
    const data = await service.updateStaffStatus(c.req.param("id")!, body.status, actor);
    return c.json({ success: true, data });
  } catch (error: any) {
    return handleStaffError(c, error);
  }
});

// Deleting staff: ADMIN only
staffRoutes.delete("/:id", requireRole("ADMIN"), async (c) => {
  try {
    const actor = getActorFromContext(c);
    await service.deleteStaff(c.req.param("id")!, actor);
    return c.json({ success: true });
  } catch (error: any) {
    return handleStaffError(c, error);
  }
});

// --- Roles nested routes ---

// View staff roles: Staff member (self) or ADMIN/HOD
staffRoutes.get("/:id/roles", requireStaffOrAdmin, async (c) => {
  try {
    const data = await service.getStaffRoles(c.req.param("id")!);
    return c.json({ success: true, data });
  } catch (error: any) {
    return handleStaffError(c, error);
  }
});

// Assigning role: ADMIN only (prevents privilege escalation)
staffRoutes.post("/:id/roles", requireRole("ADMIN"), async (c) => {
  try {
    const actor = getActorFromContext(c);
    const body = await c.req.json();
    const data = await service.assignRole(c.req.param("id")!, body.role, actor);
    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    return handleStaffError(c, error);
  }
});

// Removing role: ADMIN only
staffRoutes.delete("/:id/roles/:roleName", requireRole("ADMIN"), async (c) => {
  try {
    const actor = getActorFromContext(c);
    const data = await service.removeRole(c.req.param("id")!, c.req.param("roleName")!, actor);
    return c.json({ success: true, data });
  } catch (error: any) {
    return handleStaffError(c, error);
  }
});

// --- Counselor Assignments (Nested) ---
staffRoutes.get("/:id/counselor-assignments", requireStaffOrAdmin, async (c) => {
  try {
    const data = await service.getCounselorAssignments({ staffId: c.req.param("id")! });
    return c.json({ success: true, data });
  } catch (error: any) {
    return handleStaffError(c, error);
  }
});

staffRoutes.get("/:id/timetable", requireStaffOrAdmin, async (c) => {
  try {
    const data = await timetableRepo.findByStaff(c.req.param("id")!);
    return c.json({ success: true, data });
  } catch (error: any) {
    return handleStaffError(c, error);
  }
});
