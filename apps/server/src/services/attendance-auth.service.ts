import { db } from '../db';
import { classCounselors } from '../db/schema/staff';
import { timetables, timetableOverrides } from '../db/schema/timetable';
import { attendanceSessions } from '../db/schema/attendance';
import { students } from '../db/schema/students';
import { eq, and } from 'drizzle-orm';
import type { AuthPrincipal } from '@smart-attendance/shared';

export class AttendanceAuthService {
  isLeadership(user: AuthPrincipal): boolean {
    return user.roles.some((r) => ['ADMIN', 'HOD', 'DEPUTY_HOD'].includes(r));
  }

  async isClassCounselor(user: AuthPrincipal, classId: string): Promise<boolean> {
    if (!user.roles.includes('CLASS_COUNSELOR') && !user.roles.includes('STAFF')) {
      return false;
    }
    const assignment = await db
      .select({ id: classCounselors.id })
      .from(classCounselors)
      .where(
        and(
          eq(classCounselors.staffId, user.id),
          eq(classCounselors.classId, classId),
          eq(classCounselors.status, 'ACTIVE')
        )
      )
      .limit(1)
      .then((rows) => rows[0]);
    return Boolean(assignment);
  }

  async getCounselorClassIds(user: AuthPrincipal): Promise<string[]> {
    const rows = await db
      .select({ classId: classCounselors.classId })
      .from(classCounselors)
      .where(
        and(
          eq(classCounselors.staffId, user.id),
          eq(classCounselors.status, 'ACTIVE')
        )
      );
    return rows.map((r) => r.classId);
  }

  async canAccessClass(user: AuthPrincipal, classId: string): Promise<boolean> {
    if (this.isLeadership(user)) return true;
    if (await this.isClassCounselor(user, classId)) return true;

    // Check if staff teaches any timetable entry in this class
    const teaches = await db
      .select({ id: timetables.id })
      .from(timetables)
      .where(
        and(
          eq(timetables.classId, classId),
          eq(timetables.staffId, user.id),
          eq(timetables.status, 'ACTIVE')
        )
      )
      .limit(1)
      .then((rows) => rows[0]);
    return Boolean(teaches);
  }

  async canAccessSession(user: AuthPrincipal, session: {
    id: string;
    timetableId: string;
    classId?: string;
    staffId?: string;
    startedByStaffId?: string | null;
    sessionDate?: string;
  }): Promise<boolean> {
    if (this.isLeadership(user)) return true;

    // Direct staff ownership
    if (session.startedByStaffId === user.id || session.staffId === user.id) {
      return true;
    }

    // Resolve timetable classId and staffId if not present
    let classId = session.classId;
    let assignedStaffId = session.staffId;
    if (!classId || !assignedStaffId) {
      const [tt] = await db
        .select({ classId: timetables.classId, staffId: timetables.staffId })
        .from(timetables)
        .where(eq(timetables.id, session.timetableId));
      if (tt) {
        classId = tt.classId;
        assignedStaffId = tt.staffId;
      }
    }

    if (assignedStaffId === user.id) return true;

    // Check replacement staff for override
    if (session.sessionDate) {
      const [override] = await db
        .select({ replacementStaffId: timetableOverrides.replacementStaffId })
        .from(timetableOverrides)
        .where(
          and(
            eq(timetableOverrides.timetableId, session.timetableId),
            eq(timetableOverrides.overrideDate, session.sessionDate),
            eq(timetableOverrides.status, 'ACTIVE')
          )
        );
      if (override?.replacementStaffId === user.id) return true;
    }

    // Check if user is counselor for this session's class
    if (classId && (await this.isClassCounselor(user, classId))) {
      return true;
    }

    return false;
  }

  async canMutateSession(user: AuthPrincipal, session: {
    id: string;
    timetableId: string;
    classId?: string;
    staffId?: string;
    startedByStaffId?: string | null;
    sessionDate?: string;
  }): Promise<boolean> {
    if (this.isLeadership(user)) return true;

    if (session.startedByStaffId === user.id || session.staffId === user.id) {
      return true;
    }

    if (session.sessionDate) {
      const [override] = await db
        .select({ replacementStaffId: timetableOverrides.replacementStaffId })
        .from(timetableOverrides)
        .where(
          and(
            eq(timetableOverrides.timetableId, session.timetableId),
            eq(timetableOverrides.overrideDate, session.sessionDate),
            eq(timetableOverrides.status, 'ACTIVE')
          )
        );
      if (override?.replacementStaffId === user.id) return true;
    }

    let classId = session.classId;
    if (!classId) {
      const [tt] = await db
        .select({ classId: timetables.classId })
        .from(timetables)
        .where(eq(timetables.id, session.timetableId));
      if (tt) classId = tt.classId;
    }

    if (classId && (await this.isClassCounselor(user, classId))) {
      return true;
    }

    return false;
  }

  async canMutateRecord(user: AuthPrincipal, record: {
    id: string;
    classId?: string;
    sessionId?: string;
    studentId?: string;
  }): Promise<boolean> {
    if (this.isLeadership(user)) return true;

    let classId = record.classId;
    if (!classId && record.studentId) {
      const [st] = await db.select({ classId: students.classId }).from(students).where(eq(students.id, record.studentId));
      if (st) classId = st.classId;
    }

    if (classId && (await this.isClassCounselor(user, classId))) {
      return true;
    }

    if (record.sessionId) {
      const [sess] = await db
        .select({
          startedByStaffId: attendanceSessions.startedByStaffId,
          timetableId: attendanceSessions.timetableId,
          sessionDate: attendanceSessions.sessionDate,
        })
        .from(attendanceSessions)
        .where(eq(attendanceSessions.id, record.sessionId));
      if (sess) {
        if (sess.startedByStaffId === user.id) return true;
        const [tt] = await db
          .select({ staffId: timetables.staffId, classId: timetables.classId })
          .from(timetables)
          .where(eq(timetables.id, sess.timetableId));
        if (tt?.staffId === user.id) return true;
        if (tt?.classId && (await this.isClassCounselor(user, tt.classId))) return true;
      }
    }

    return false;
  }
}

export const attendanceAuthService = new AttendanceAuthService();
