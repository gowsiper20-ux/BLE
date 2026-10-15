import { Hono } from "hono";
import { SubjectService } from "../services/subject.service";
import { ClassSubjectService } from "../services/class-subject.service";

export const subjectRoutes = new Hono();
const service = new SubjectService();
const classSubjectService = new ClassSubjectService();

subjectRoutes.get("/", async (c) => {
  try {
    const search = c.req.query("search");
    const type = c.req.query("type");
    const year = c.req.query("year") ? parseInt(c.req.query("year")!, 10) : undefined;
    const regulationId = c.req.query("regulationId");
    const status = c.req.query("status");
    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = parseInt(c.req.query("limit") || "20", 10);

    const data = await service.getSubjects({ search, type, year, regulationId, status, page, limit });
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

subjectRoutes.get("/stats", async (c) => {
    try {
        const data = await service.getSubjects({ limit: 10000 });
        const total = data.pagination.total;
        const active = data.subjects.filter(s => s.status === 'ACTIVE').length;
        const theory = data.subjects.filter(s => s.subjectType === 'THEORY').length;
        const lab = data.subjects.filter(s => s.subjectType === 'LAB').length;

        return c.json({ success: true, data: { total, active, theory, lab } });
    } catch (error: any) {
        return c.json({ success: false, error: { message: error.message } }, 500);
    }
});

subjectRoutes.get("/:id", async (c) => {
  try {
    const data = await service.getSubjectById(c.req.param("id"));
    if (!data) return c.json({ success: false, error: { message: "Subject not found" } }, 404);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

subjectRoutes.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.createSubject(body);
    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: { code: error.message, message: error.message } }, 400);
  }
});

subjectRoutes.patch("/:id", async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.updateSubject(c.req.param("id"), body);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

subjectRoutes.patch("/:id/status", async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.updateSubjectStatus(c.req.param("id"), body.status);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

subjectRoutes.delete("/:id", async (c) => {
  try {
    await service.deleteSubject(c.req.param("id"));
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

// Assigned classes
subjectRoutes.get("/:id/classes", async (c) => {
  try {
    const data = await classSubjectService.getClassesBySubject(c.req.param("id"));
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});
