import { Hono } from "hono";
import { SubjectService } from "../services/subject.service";
import { ClassSubjectService } from "../services/class-subject.service";
import { requireHodOrAdmin, requireSharedModuleAccess, requireSharedDashboardRead } from "../middlewares/auth.middleware";
import type { AuthPrincipal } from "@smart-attendance/shared";
import { Buffer } from "node:buffer";
import { TabularImportError } from "../services/tabular-import";
import * as xlsx from 'xlsx';

export const subjectRoutes = new Hono();
const service = new SubjectService();
const classSubjectService = new ClassSubjectService();

function getActorFromContext(c: any) {
  const user = c.get('user') as AuthPrincipal | undefined;
  return {
    actorId: user?.roles?.includes('FACULTY') ? undefined : user?.id,
    actorName: user?.name || user?.collegeEmail || 'System User',
    actorRole: user?.roles?.[0] || 'ADMIN',
    ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || '127.0.0.1',
    userAgent: c.req.header('user-agent'),
  };
}

async function getImportFile(c: any): Promise<{ file: File; buffer: Buffer } | Response> {
  const contentLength = Number(c.req.header('content-length'));
  if (Number.isFinite(contentLength) && contentLength > 5 * 1024 * 1024 + 64 * 1024) {
    return c.json({ success: false, error: { code: 'FILE_TOO_LARGE', message: 'Import files are limited to 5 MB.' } }, 413);
  }
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Choose a CSV or XLSX file.' } }, 400);
  }
  if (file.size > 5 * 1024 * 1024) {
    return c.json({ success: false, error: { code: 'FILE_TOO_LARGE', message: 'Import files are limited to 5 MB.' } }, 413);
  }
  const extension = file.name.toLowerCase().split('.').pop();
  const allowedTypes = extension === 'csv'
    ? ['text/csv', 'application/vnd.ms-excel', 'application/octet-stream', '']
    : extension === 'xlsx'
      ? ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream', '']
      : [];
  if (!allowedTypes.includes(file.type.toLowerCase())) {
    return c.json({ success: false, error: { code: 'UNSUPPORTED_FILE', message: 'Upload a valid .csv or .xlsx file.' } }, 400);
  }
  return { file, buffer: Buffer.from(await file.arrayBuffer()) };
}

function handleSubjectError(c: any, error: any) {
  const msg = error?.message || 'An unexpected error occurred.';
  if (error instanceof TabularImportError) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: msg } }, 400);
  }
  if (
    msg.includes('already exists') ||
    msg.includes('Cannot delete') ||
    msg.includes('is referenced by') ||
    msg.includes('unverified legacy') ||
    msg.includes('cannot be overwritten') ||
    msg.includes('cannot be edited') ||
    msg.includes('cannot be changed')
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
    msg.includes('must be') ||
    msg.includes('Invalid')
  ) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: msg } }, 400);
  }
  return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: msg } }, 500);
}

// --- Bulk Import ---
subjectRoutes.get('/import/template', requireSharedDashboardRead, (c) => {
  const format = c.req.query('format')?.toLowerCase();
  if (format === 'xlsx') {
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([
      ['code', 'name', 'subject_type', 'year_number', 'regulation_code', 'description'],
      ['CS3401', 'Algorithms and Data Structures', 'THEORY', '2', 'R2023', 'Core Subject']
    ]);
    xlsx.utils.book_append_sheet(wb, ws, 'Subjects Template');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    c.header('Content-Disposition', 'attachment; filename="subject-import-template.xlsx"');
    return c.body(buf);
  }
  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', 'attachment; filename="subject-import-template.csv"');
  return c.body('code,name,subject_type,year_number,regulation_code,description\r\nCS3401,Algorithms and Data Structures,THEORY,2,R2023,Core Subject\r\n');
});

subjectRoutes.get('/template/xlsx', requireSharedDashboardRead, (c) => {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet([
    ['code', 'name', 'subject_type', 'year_number', 'regulation_code', 'description'],
    ['CS3401', 'Algorithms and Data Structures', 'THEORY', '2', 'R2023', 'Core Subject']
  ]);
  xlsx.utils.book_append_sheet(wb, ws, 'Subjects Template');
  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  c.header('Content-Disposition', 'attachment; filename="subject-import-template.xlsx"');
  return c.body(buf);
});

subjectRoutes.get('/template/csv', requireSharedDashboardRead, (c) => {
  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', 'attachment; filename="subject-import-template.csv"');
  return c.body('code,name,subject_type,year_number,regulation_code,description\r\nCS3401,Algorithms and Data Structures,THEORY,2,R2023,Core Subject\r\n');
});

subjectRoutes.post('/import/preview', requireHodOrAdmin, async (c) => {
  try {
    const upload = await getImportFile(c);
    if (upload instanceof Response) return upload;
    const data = await service.validateImportFile(upload.buffer, upload.file.name);
    return c.json({ success: true, data });
  } catch (error: unknown) {
    return handleSubjectError(c, error);
  }
});

subjectRoutes.post('/import/confirm', requireHodOrAdmin, async (c) => {
  try {
    const upload = await getImportFile(c);
    if (upload instanceof Response) return upload;
    const data = await service.confirmImport(upload.buffer, upload.file.name, getActorFromContext(c));
    return c.json({ success: true, data });
  } catch (error: unknown) {
    return handleSubjectError(c, error);
  }
});

subjectRoutes.get("/", requireSharedDashboardRead, async (c) => {
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
    return handleSubjectError(c, error);
  }
});

subjectRoutes.get("/stats", requireSharedDashboardRead, async (c) => {
  try {
    const data = await service.getSubjects({ limit: 10000 });
    const total = data.pagination.total;
    const active = data.subjects.filter(s => s.status === 'ACTIVE').length;
    const theory = data.subjects.filter(s => s.subjectType === 'THEORY').length;
    const lab = data.subjects.filter(s => s.subjectType === 'LAB').length;

    return c.json({ success: true, data: { total, active, theory, lab } });
  } catch (error: any) {
    return handleSubjectError(c, error);
  }
});

subjectRoutes.get("/:id", requireSharedDashboardRead, async (c) => {
  try {
    const data = await service.getSubjectById(c.req.param("id")!);
    if (!data) return c.json({ success: false, error: { code: 'NOT_FOUND', message: "Subject not found." } }, 404);
    return c.json({ success: true, data });
  } catch (error: any) {
    return handleSubjectError(c, error);
  }
});

subjectRoutes.post("/", requireHodOrAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const actor = getActorFromContext(c);
    const data = await service.createSubject(body, actor);
    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    return handleSubjectError(c, error);
  }
});

subjectRoutes.patch("/:id", requireHodOrAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const actor = getActorFromContext(c);
    const data = await service.updateSubject(c.req.param("id")!, body, actor);
    return c.json({ success: true, data });
  } catch (error: any) {
    return handleSubjectError(c, error);
  }
});

subjectRoutes.patch("/:id/status", requireHodOrAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const actor = getActorFromContext(c);
    const data = await service.updateSubjectStatus(c.req.param("id")!, body.status, actor);
    return c.json({ success: true, data });
  } catch (error: any) {
    return handleSubjectError(c, error);
  }
});

subjectRoutes.delete("/:id", requireHodOrAdmin, async (c) => {
  try {
    const actor = getActorFromContext(c);
    await service.deleteSubject(c.req.param("id")!, actor);
    return c.json({ success: true });
  } catch (error: any) {
    return handleSubjectError(c, error);
  }
});

// Assigned classes
subjectRoutes.get("/:id/classes", requireSharedDashboardRead, async (c) => {
  try {
    const data = await classSubjectService.getClassesBySubject(c.req.param("id")!);
    return c.json({ success: true, data });
  } catch (error: any) {
    return handleSubjectError(c, error);
  }
});
