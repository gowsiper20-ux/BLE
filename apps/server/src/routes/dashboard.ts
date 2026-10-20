import { Hono } from "hono";
import { db } from "../db";
import { classes, departments, academicYears } from "../db/schema/academic";
import { students } from "../db/schema/students";
import { staff } from "../db/schema/staff";
import { subjects } from "../db/schema/subjects";
import { auditLogs } from "../db/schema/audit";
import { TimetableService } from "../services/timetable.service";
import { AttendanceSessionService } from "../services/attendance-session.service";
import { requireSharedDashboardRead } from "../middlewares/auth.middleware";
import { eq, and, sql, desc } from "drizzle-orm";
import { getDateInTimeZone } from "../utils/date";

export const dashboardRoutes = new Hono();
const timetableService = new TimetableService();
const attendanceService = new AttendanceSessionService();

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getActionColor(action: string): "success" | "info" | "warning" | "error" {
  if (action.includes("CREATE") || action.includes("ASSIGN") || action.includes("CONFIRM")) return "success";
  if (action.includes("UPDATE") || action.includes("EDIT")) return "info";
  if (action.includes("DEACTIVATE") || action.includes("CANCEL")) return "warning";
  if (action.includes("DELETE") || action.includes("REMOVE")) return "error";
  return "info";
}

function formatActionTitle(action: string): string {
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

dashboardRoutes.get("/stats", requireSharedDashboardRead, async (c) => {
  try {
    const todayStr = getDateInTimeZone();

    const [
      [classesCountRes],
      [studentsCountRes],
      [staffCountRes],
      [subjectsCountRes],
      timetableStats,
      attendanceStats,
    ] = await Promise.all([
      db.select({ count: sql`count(*)`.mapWith(Number) }).from(classes).where(eq(classes.status, "ACTIVE")),
      db.select({ count: sql`count(*)`.mapWith(Number) }).from(students).where(eq(students.status, "ACTIVE")),
      db.select({ count: sql`count(*)`.mapWith(Number) }).from(staff).where(eq(staff.status, "ACTIVE")),
      db.select({ count: sql`count(*)`.mapWith(Number) }).from(subjects).where(eq(subjects.status, "ACTIVE")),
      timetableService.getTimetableStats(),
      attendanceService.getStats(todayStr),
    ]);

    return c.json({
      success: true,
      data: {
        classes: classesCountRes?.count || 0,
        students: studentsCountRes?.count || 0,
        staff: staffCountRes?.count || 0,
        subjects: subjectsCountRes?.count || 0,
        scheduledToday: timetableStats.todayEntries,
        activeSessions: attendanceStats.activeToday,
        completedToday: attendanceStats.completedToday,
        cancelledToday: attendanceStats.cancelledToday,
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

dashboardRoutes.get("/today-timetable", requireSharedDashboardRead, async (c) => {
  try {
    const timetable = await timetableService.getTodayTimetable();
    const formatted = timetable.map((t) => ({
      id: t.id,
      period: `Period ${t.periodNumber}`,
      periodNumber: t.periodNumber,
      time: `${t.periodStartTime.slice(0, 5)} - ${t.periodEndTime.slice(0, 5)}`,
      class: t.className,
      subject: `${t.subjectCode} - ${t.subjectName}`,
      subjectCode: t.subjectCode,
      subjectName: t.subjectName,
      staff: t.staffName,
      status: t.status,
    }));
    return c.json({ success: true, data: formatted });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

dashboardRoutes.get("/recent-activity", requireSharedDashboardRead, async (c) => {
  try {
    const logs = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        description: auditLogs.description,
        actorName: auditLogs.actorName,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(10);

    const formatted = logs.map((log) => ({
      id: log.id,
      action: formatActionTitle(log.action),
      detail: log.description,
      actor: log.actorName || 'Actor not recorded',
      type: getActionColor(log.action),
      time: formatRelativeTime(new Date(log.createdAt)),
      timestamp: log.createdAt,
    }));

    return c.json({ success: true, data: formatted });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});
