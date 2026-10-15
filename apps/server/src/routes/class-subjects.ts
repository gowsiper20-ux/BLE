import { Hono } from "hono";
import { ClassSubjectService } from "../services/class-subject.service";

export const classSubjectRoutes = new Hono();
const service = new ClassSubjectService();

classSubjectRoutes.get("/", async (c) => {
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
      return c.json({ success: false, error: { message: 'Must provide classId or subjectId' } }, 400);
    }

    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

classSubjectRoutes.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.assignSubjectToClass(body);
    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: { code: error.message, message: error.message } }, 400);
  }
});

classSubjectRoutes.patch("/:id/status", async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.updateAssignmentStatus(c.req.param("id"), body.status);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

classSubjectRoutes.delete("/:id", async (c) => {
  try {
    await service.removeAssignment(c.req.param("id"));
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});
