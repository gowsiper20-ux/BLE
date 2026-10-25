import { Hono } from "hono";
import { TimetableService } from "../services/timetable.service";
import { TimetableOverrideService } from "../services/timetable-override.service";
import { db } from "../db";
import { count, eq } from "drizzle-orm";
import { requireHodOrAdmin, requireSharedDashboardRead } from "../middlewares/auth.middleware";
import type { AuthPrincipal } from "@smart-attendance/shared";

export const timetableRoutes = new Hono();
const service = new TimetableService();
const overrideService = new TimetableOverrideService();

function getActorFromContext(c: any) {
  const user = c.get("user") as AuthPrincipal | undefined;
  return user ? {
    actorId: user.roles.includes('FACULTY') ? undefined : user.id,
    actorName: user.name,
    actorRole: user.roles?.[0] || 'HOD',
    ipAddress: c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || '127.0.0.1',
    userAgent: c.req.header('user-agent'),
  } : undefined;
}

// --- Overrides ---
timetableRoutes.get("/overrides", requireSharedDashboardRead, async (c) => {
  try {
    const data = await overrideService.getOverrides();
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

timetableRoutes.post("/overrides", requireHodOrAdmin, async (c) => {
  try {
    const body = await c.req.json();
    if (body.overrideDate) {
      if (typeof body.overrideDate === 'string') {
        body.overrideDate = body.overrideDate.split('T')[0];
      } else if (body.overrideDate instanceof Date) {
        body.overrideDate = body.overrideDate.toISOString().split('T')[0];
      }
    }
    const actor = getActorFromContext(c);
    const data = await overrideService.createOverride(body, actor);
    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: { code: error.message, message: error.message } }, 400);
  }
});

timetableRoutes.patch("/overrides/:id", requireHodOrAdmin, async (c) => {
  try {
    const body = await c.req.json();
    if (body.overrideDate) {
      if (typeof body.overrideDate === 'string') {
        body.overrideDate = body.overrideDate.split('T')[0];
      } else if (body.overrideDate instanceof Date) {
        body.overrideDate = body.overrideDate.toISOString().split('T')[0];
      }
    }
    const actor = getActorFromContext(c);
    const data = await overrideService.updateOverride(c.req.param("id")!, body, actor);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

timetableRoutes.delete("/overrides/:id", requireHodOrAdmin, async (c) => {
  try {
    const actor = getActorFromContext(c);
    await overrideService.deleteOverride(c.req.param("id")!, actor);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

// --- Core Timetable ---

timetableRoutes.get("/", requireSharedDashboardRead, async (c) => {
  try {
    const classId = c.req.query("classId");
    const academicYearId = c.req.query("academicYearId");
    const staffId = c.req.query("staffId");

    if (!classId && !staffId) {
      return c.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Provide either classId or staffId to retrieve timetable entries.' },
      }, 400);
    }
    if (classId && staffId) {
      return c.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Provide classId or staffId, not both.' },
      }, 400);
    }

    const data = classId
      ? await service.getTimetableByClass(classId, academicYearId)
      : await service.getTimetableByStaff(staffId!, academicYearId);

    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

timetableRoutes.post("/", requireHodOrAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const actor = getActorFromContext(c);
    const data = await service.createTimetableEntry(body, actor);
    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: { code: error.message, message: error.message } }, 409);
  }
});

timetableRoutes.patch("/:id", requireHodOrAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const actor = getActorFromContext(c);
    const data = await service.updateTimetableEntry(c.req.param("id")!, body, actor);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { code: error.message, message: error.message } }, 409);
  }
});

timetableRoutes.delete("/:id", requireHodOrAdmin, async (c) => {
  try {
    const actor = getActorFromContext(c);
    await service.deleteTimetableEntry(c.req.param("id")!, actor);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

// --- Additional Routes ---
timetableRoutes.get("/stats", requireSharedDashboardRead, async (c) => {
  try {
    const academicYearId = c.req.query("academicYearId");
    const data = await service.getTimetableStats(academicYearId);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

timetableRoutes.get("/today", requireSharedDashboardRead, async (c) => {
  try {
    const academicYearId = c.req.query("academicYearId");
    const classId = c.req.query("classId");
    const data = await service.getTodayTimetable(academicYearId, classId);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});
