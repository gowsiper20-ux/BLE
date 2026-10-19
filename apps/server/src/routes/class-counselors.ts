import { Hono } from "hono";
import { StaffService } from "../services/staff.service";
import { requireHodOrAdmin, requireStaffOrAdmin } from "../middlewares/auth.middleware";
import type { AuthPrincipal } from "@smart-attendance/shared";

export const counselorRoutes = new Hono();
const service = new StaffService();

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

function handleCounselorError(c: any, error: any) {
  const msg = error?.message || 'An unexpected error occurred.';
  if (
    msg.includes('already exists') ||
    msg.includes('already the active counselor')
  ) {
    return c.json({ success: false, error: { code: 'CONFLICT', message: msg } }, 409);
  }
  if (msg.includes('not found') || msg.includes('Not found')) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: msg } }, 404);
  }
  if (
    msg.includes('required') ||
    msg.includes('Cannot assign counselor role to inactive staff') ||
    msg.includes('Invalid')
  ) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: msg } }, 400);
  }
  return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: msg } }, 500);
}

counselorRoutes.get("/", requireStaffOrAdmin, async (c) => {
  try {
    const classId = c.req.query("classId");
    const academicYearId = c.req.query("academicYearId");
    const staffId = c.req.query("staffId");

    const data = await service.getCounselorAssignments({ classId, academicYearId, staffId });
    return c.json({ success: true, data });
  } catch (error: any) {
    return handleCounselorError(c, error);
  }
});

counselorRoutes.post("/", requireHodOrAdmin, async (c) => {
  try {
    const actor = getActorFromContext(c);
    const body = await c.req.json();
    const data = await service.assignCounselor(body, actor);
    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    return handleCounselorError(c, error);
  }
});

counselorRoutes.patch("/:id/status", requireHodOrAdmin, async (c) => {
  try {
    const actor = getActorFromContext(c);
    const body = await c.req.json();
    const data = await service.updateCounselorStatus(c.req.param("id")!, body.status, actor);
    return c.json({ success: true, data });
  } catch (error: any) {
    return handleCounselorError(c, error);
  }
});

counselorRoutes.delete("/:id", requireHodOrAdmin, async (c) => {
  try {
    const actor = getActorFromContext(c);
    await service.deleteCounselorAssignment(c.req.param("id")!, actor);
    return c.json({ success: true });
  } catch (error: any) {
    return handleCounselorError(c, error);
  }
});
