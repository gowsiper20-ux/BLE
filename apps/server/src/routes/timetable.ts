import { Hono } from "hono";
import { TimetableService } from "../services/timetable.service";
import { TimetableOverrideService } from "../services/timetable-override.service";
import { db } from "../db";
import { count, eq } from "drizzle-orm";

export const timetableRoutes = new Hono();
const service = new TimetableService();
const overrideService = new TimetableOverrideService();

// --- Overrides ---
timetableRoutes.get("/overrides", async (c) => {
  try {
    const data = await overrideService.getOverrides();
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

timetableRoutes.post("/overrides", async (c) => {
  try {
    const body = await c.req.json();
    // Convert string to Date for the database
    if (body.overrideDate) {
      body.overrideDate = new Date(body.overrideDate);
    }
    const data = await overrideService.createOverride(body);
    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: { code: error.message, message: error.message } }, 400);
  }
});

timetableRoutes.patch("/overrides/:id", async (c) => {
  try {
    const body = await c.req.json();
    if (body.overrideDate) {
      body.overrideDate = new Date(body.overrideDate);
    }
    const data = await overrideService.updateOverride(c.req.param("id"), body);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

timetableRoutes.delete("/overrides/:id", async (c) => {
  try {
    await overrideService.deleteOverride(c.req.param("id"));
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

// --- Core Timetable ---

timetableRoutes.get("/", async (c) => {
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
      // Just returning empty if neither provided for now
      data = [];
    }

    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

timetableRoutes.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.createTimetableEntry(body);
    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: { code: error.message, message: error.message } }, 409);
  }
});

timetableRoutes.patch("/:id", async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.updateTimetableEntry(c.req.param("id"), body);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { code: error.message, message: error.message } }, 409);
  }
});

timetableRoutes.delete("/:id", async (c) => {
  try {
    await service.deleteTimetableEntry(c.req.param("id"));
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

// --- Additional Routes ---
timetableRoutes.get("/stats", async (c) => {
  try {
    // A proper implementation would run real aggregation queries for the rest
    return c.json({
      success: true,
      data: {
        totalEntries: 0,
        todayEntries: 0,
        classesScheduledToday: 0,
        staffScheduledToday: 0
      }
    });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});
