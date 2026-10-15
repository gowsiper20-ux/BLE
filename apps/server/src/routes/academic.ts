import { Hono } from "hono";
import { AcademicService } from "../services/academic.service";
import { StaffService } from "../services/staff.service";
import { ClassSubjectService } from "../services/class-subject.service";
import { TimetableRepository } from "../repositories/timetable.repository";

export const academicRoutes = new Hono();
const service = new AcademicService();
const staffService = new StaffService();
const classSubjectService = new ClassSubjectService();
const timetableRepo = new TimetableRepository();

// --- Departments ---
academicRoutes.get("/departments", async (c) => {
  try {
    const data = await service.getDepartments();
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

// --- Academic Years ---
academicRoutes.get("/academic-years", async (c) => {
  try {
    const data = await service.getAcademicYears();
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

academicRoutes.get("/academic-years/:id", async (c) => {
  try {
    const data = await service.getAcademicYearById(c.req.param("id"));
    if (!data) return c.json({ success: false, error: { message: "Not found" } }, 404);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

academicRoutes.post("/academic-years", async (c) => {
  try {
    const body = await c.req.json();
    body.startDate = new Date(body.startDate);
    body.endDate = new Date(body.endDate);
    const data = await service.createAcademicYear(body);
    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      return c.json({ success: false, error: { code: 'CONFLICT', message: error.message } }, 409);
    }
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.message } }, 400);
  }
});

academicRoutes.patch("/academic-years/:id", async (c) => {
  try {
    const body = await c.req.json();
    if (body.startDate) body.startDate = new Date(body.startDate);
    if (body.endDate) body.endDate = new Date(body.endDate);
    const data = await service.updateAcademicYear(c.req.param("id"), body);
    return c.json({ success: true, data });
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      return c.json({ success: false, error: { code: 'CONFLICT', message: error.message } }, 409);
    }
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.message } }, 400);
  }
});

academicRoutes.delete("/academic-years/:id", async (c) => {
  try {
    await service.deleteAcademicYear(c.req.param("id"));
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: { message: "Cannot delete this record because it is referenced." } }, 409);
  }
});

// --- Batches ---
academicRoutes.get("/batches", async (c) => {
  try {
    const data = await service.getBatches();
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

academicRoutes.get("/batches/:id", async (c) => {
  try {
    const data = await service.getBatchById(c.req.param("id"));
    if (!data) return c.json({ success: false, error: { message: "Not found" } }, 404);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

academicRoutes.post("/batches", async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.createBatch(body);
    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      return c.json({ success: false, error: { code: 'CONFLICT', message: error.message } }, 409);
    }
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.message } }, 400);
  }
});

academicRoutes.patch("/batches/:id", async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.updateBatch(c.req.param("id"), body);
    return c.json({ success: true, data });
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      return c.json({ success: false, error: { code: 'CONFLICT', message: error.message } }, 409);
    }
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.message } }, 400);
  }
});

academicRoutes.delete("/batches/:id", async (c) => {
  try {
    await service.deleteBatch(c.req.param("id"));
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: { message: "Cannot delete this record because it is referenced." } }, 409);
  }
});

// --- Regulations ---
academicRoutes.get("/regulations", async (c) => {
  try {
    const data = await service.getRegulations();
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

academicRoutes.get("/regulations/:id", async (c) => {
  try {
    const data = await service.getRegulationById(c.req.param("id"));
    if (!data) return c.json({ success: false, error: { message: "Not found" } }, 404);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

academicRoutes.post("/regulations", async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.createRegulation(body);
    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.message } }, 400);
  }
});

academicRoutes.patch("/regulations/:id", async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.updateRegulation(c.req.param("id"), body);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.message } }, 400);
  }
});

academicRoutes.delete("/regulations/:id", async (c) => {
  try {
    await service.deleteRegulation(c.req.param("id"));
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: { message: "Cannot delete this record because it is referenced." } }, 409);
  }
});

// --- Classes ---
academicRoutes.get("/classes", async (c) => {
  try {
    const data = await service.getClasses();
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

academicRoutes.get("/classes/:id", async (c) => {
  try {
    const data = await service.getClassById(c.req.param("id"));
    if (!data) return c.json({ success: false, error: { message: "Not found" } }, 404);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

academicRoutes.post("/classes", async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.createClass(body);
    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      return c.json({ success: false, error: { code: 'CONFLICT', message: error.message } }, 409);
    }
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.message } }, 400);
  }
});

academicRoutes.patch("/classes/:id", async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.updateClass(c.req.param("id"), body);
    return c.json({ success: true, data });
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      return c.json({ success: false, error: { code: 'CONFLICT', message: error.message } }, 409);
    }
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.message } }, 400);
  }
});

academicRoutes.delete("/classes/:id", async (c) => {
  try {
    await service.deleteClass(c.req.param("id"));
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: { message: "Cannot delete this record because it is referenced." } }, 409);
  }
});

academicRoutes.get("/classes/:id/counselor", async (c) => {
  try {
    const data = await staffService.getCounselorAssignments({ classId: c.req.param("id") });
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

academicRoutes.get("/classes/:id/subjects", async (c) => {
  try {
    const data = await classSubjectService.getSubjectsByClass(c.req.param("id"));
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

academicRoutes.get("/classes/:id/timetable", async (c) => {
  try {
    const data = await timetableRepo.findByClass(c.req.param("id"));
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});
