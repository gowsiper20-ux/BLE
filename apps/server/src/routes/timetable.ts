import { Hono } from "hono";
import { TimetableService } from "../services/timetable.service";
import { TimetableOverrideService } from "../services/timetable-override.service";
import { db } from "../db";
import { count, eq } from "drizzle-orm";
import { requireSharedModuleAccess, requireSharedDashboardRead } from "../middlewares/auth.middleware";

export const timetableRoutes = new Hono();
const service = new TimetableService();
const overrideService = new TimetableOverrideService();

// --- Overrides ---
timetableRoutes.get("/overrides", requireSharedDashboardRead, async (c) => {
  try {
    const data = await overrideService.getOverrides();
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

timetableRoutes.post("/overrides", requireSharedModuleAccess, async (c) => {
  try {
    const user = c.get("user") as any;
    const body = await c.req.json();
    if (body.overrideDate) {
      if (typeof body.overrideDate === 'string') {
        body.overrideDate = body.overrideDate.split('T')[0];
      } else if (body.overrideDate instanceof Date) {
        body.overrideDate = body.overrideDate.toISOString().split('T')[0];
      }
    }
    const actor = user ? {
      actorId: user.roles.includes('FACULTY') ? undefined : user.id,
      actorName: user.name,
      actorRole: user.roles?.[0] || 'HOD',
      ipAddress: c.req.header('x-forwarded-for') || undefined,
      userAgent: c.req.header('user-agent') || undefined,
    } : undefined;
    const data = await overrideService.createOverride(body, actor);
    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: { code: error.message, message: error.message } }, 400);
  }
});

timetableRoutes.patch("/overrides/:id", requireSharedModuleAccess, async (c) => {
  try {
    const user = c.get("user") as any;
    const body = await c.req.json();
    if (body.overrideDate) {
      if (typeof body.overrideDate === 'string') {
        body.overrideDate = body.overrideDate.split('T')[0];
      } else if (body.overrideDate instanceof Date) {
        body.overrideDate = body.overrideDate.toISOString().split('T')[0];
      }
    }
    const actor = user ? {
      actorId: user.roles.includes('FACULTY') ? undefined : user.id,
      actorName: user.name,
      actorRole: user.roles?.[0] || 'HOD',
      ipAddress: c.req.header('x-forwarded-for') || undefined,
      userAgent: c.req.header('user-agent') || undefined,
    } : undefined;
    const data = await overrideService.updateOverride(c.req.param("id")!, body, actor);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

timetableRoutes.delete("/overrides/:id", requireSharedModuleAccess, async (c) => {
  try {
    const user = c.get("user") as any;
    const actor = user ? {
      actorId: user.roles.includes('FACULTY') ? undefined : user.id,
      actorName: user.name,
      actorRole: user.roles?.[0] || 'HOD',
      ipAddress: c.req.header('x-forwarded-for') || undefined,
      userAgent: c.req.header('user-agent') || undefined,
    } : undefined;
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

    let data: any[] = [];
    if (classId) {
      data = await service.getTimetableByClass(classId, academicYearId);
    } else if (staffId) {
      data = await service.getTimetableByStaff(staffId, academicYearId);
    } else {
      data = [];
    }

    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

timetableRoutes.post("/", requireSharedModuleAccess, async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.createTimetableEntry(body);
    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: { code: error.message, message: error.message } }, 409);
  }
});

timetableRoutes.patch("/:id", requireSharedModuleAccess, async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.updateTimetableEntry(c.req.param("id")!, body);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { code: error.message, message: error.message } }, 409);
  }
});

timetableRoutes.delete("/:id", requireSharedModuleAccess, async (c) => {
  try {
    await service.deleteTimetableEntry(c.req.param("id")!);
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
