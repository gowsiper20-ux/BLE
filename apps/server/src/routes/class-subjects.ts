import { Hono } from "hono";
import { ClassSubjectService } from "../services/class-subject.service";
import { requireHodOrAdmin, requireStaffOrAdmin } from "../middlewares/auth.middleware";
import type { AuthPrincipal } from "@smart-attendance/shared";

export const classSubjectRoutes = new Hono();
const service = new ClassSubjectService();

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

function handleClassSubjectError(c: any, error: any) {
  const msg = error?.message || 'An unexpected error occurred.';
  if (
    msg.includes('already assigned') ||
    msg.includes('Cannot remove') ||
    msg.includes('timetable schedule(s) are assigned') ||
    msg.includes('Unverified legacy subjects')
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
    msg.includes('mismatch') ||
    msg.includes('Cannot assign inactive') ||
    msg.includes('Must provide') ||
    msg.includes('Status must be')
  ) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: msg } }, 400);
  }
  return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: msg } }, 500);
}

classSubjectRoutes.get("/", requireStaffOrAdmin, async (c) => {
  try {
    const classId = c.req.query("classId");
    const subjectId = c.req.query("subjectId");
    const academicYearId = c.req.query("academicYearId");

    let data;
    if (classId) {
      data = await service.getSubjectsByClass(classId, academicYearId);
    } else if (subjectId) {
      data = await service.getClassesBySubject(subjectId, academicYearId);
    } else {
      return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Must provide classId or subjectId.' } }, 400);
    }

    return c.json({ success: true, data });
  } catch (error: any) {
    return handleClassSubjectError(c, error);
  }
});

classSubjectRoutes.post("/", requireHodOrAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const actor = getActorFromContext(c);
    const data = await service.assignSubjectToClass(body, actor);
    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    return handleClassSubjectError(c, error);
  }
});

classSubjectRoutes.patch("/:id/status", requireHodOrAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const actor = getActorFromContext(c);
    const data = await service.updateAssignmentStatus(c.req.param("id")!, body.status, actor);
    return c.json({ success: true, data });
  } catch (error: any) {
    return handleClassSubjectError(c, error);
  }
});

classSubjectRoutes.delete("/:id", requireHodOrAdmin, async (c) => {
  try {
    const actor = getActorFromContext(c);
    await service.removeAssignment(c.req.param("id")!, actor);
    return c.json({ success: true });
  } catch (error: any) {
    return handleClassSubjectError(c, error);
  }
});
