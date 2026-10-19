import { AttendanceRecordRepository, AttendanceRecordFilter } from "../repositories/attendance-record.repository";
import { AttendanceSessionRepository } from "../repositories/attendanceSession.repository";
import { AuditService } from "./audit.service";
import type { AuditActor } from "./staff.service";

export interface AttendanceCorrectionInput {
  recordId: string;
  newStatus: "PRESENT" | "ABSENT" | "LATE" | "MANUAL";
  reason: string;
  actor: AuditActor;
}

export interface ManualMarkInput {
  sessionId: string;
  studentId: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "MANUAL";
  reason?: string;
  actor: AuditActor;
}

export class AttendanceRecordService {
  private repo: AttendanceRecordRepository;
  private sessionRepo: AttendanceSessionRepository;
  private audit: AuditService;

  constructor() {
    this.repo = new AttendanceRecordRepository();
    this.sessionRepo = new AttendanceSessionRepository();
    this.audit = new AuditService();
  }

  async getRecords(filter: AttendanceRecordFilter = {}) {
    return await this.repo.getRecords(filter);
  }

  async getRecordById(id: string) {
    const record = await this.repo.getRecordById(id);
    if (!record) throw new Error("RECORD_NOT_FOUND");
    const corrections = await this.repo.getCorrections(id);
    return { ...record, corrections };
  }

  async getCorrections(recordId?: string) {
    return await this.repo.getCorrections(recordId);
  }

  async correctAttendance(input: AttendanceCorrectionInput) {
    if (!input.recordId) throw new Error("RECORD_ID_REQUIRED");
    if (!input.newStatus) throw new Error("NEW_STATUS_REQUIRED");
    if (!input.reason || input.reason.trim().length === 0) {
      throw new Error("CORRECTION_REASON_REQUIRED");
    }

    const validStatuses = ["PRESENT", "ABSENT", "LATE", "MANUAL"];
    if (!validStatuses.includes(input.newStatus)) {
      throw new Error("INVALID_ATTENDANCE_STATUS");
    }

    const existing = await this.repo.getRecordById(input.recordId);
    if (!existing) throw new Error("RECORD_NOT_FOUND");

    if (existing.status === input.newStatus) {
      throw new Error("STATUS_UNCHANGED");
    }

    const actorId = input.actor.actorId;
    if (!actorId) throw new Error("ACTOR_ID_REQUIRED");

    // 1. Record correction history
    const correction = await this.repo.createCorrection({
      attendanceRecordId: existing.id,
      previousStatus: existing.status,
      newStatus: input.newStatus,
      reason: input.reason.trim(),
      correctedBy: actorId,
    });

    // 2. Update the record
    const updated = await this.repo.upsertRecord({
      attendanceSessionId: existing.sessionId,
      studentId: existing.studentId,
      status: input.newStatus,
      source: "MANUAL",
      markedBy: actorId,
    });

    // 3. Audit log
    await this.audit.log({
      actorId: actorId,
      actorName: input.actor.actorName,
      actorRole: input.actor.actorRole,
      action: "CORRECT_ATTENDANCE",
      entityType: "ATTENDANCE_RECORD",
      entityId: existing.id,
      description: `Corrected attendance for ${existing.studentName} (${existing.registerNumber}) from ${existing.status} to ${input.newStatus}. Reason: ${input.reason}`,
      oldValues: { status: existing.status },
      newValues: { status: input.newStatus, reason: input.reason },
      ipAddress: input.actor.ipAddress,
      userAgent: input.actor.userAgent,
    });

    return { ...updated, correction };
  }

  async manualMark(input: ManualMarkInput) {
    if (!input.sessionId) throw new Error("SESSION_ID_REQUIRED");
    if (!input.studentId) throw new Error("STUDENT_ID_REQUIRED");
    if (!input.status) throw new Error("STATUS_REQUIRED");
    const actorId = input.actor.actorId;
    if (!actorId) throw new Error("ACTOR_ID_REQUIRED");

    const session = await this.sessionRepo.findById(input.sessionId);
    if (!session) throw new Error("SESSION_NOT_FOUND");

    const existing = await this.repo.getRecordBySessionAndStudent(input.sessionId, input.studentId);
    const previousStatus = existing ? existing.status : null;

    const record = await this.repo.upsertRecord({
      attendanceSessionId: input.sessionId,
      studentId: input.studentId,
      status: input.status,
      source: "MANUAL",
      markedBy: actorId,
    });

    if (previousStatus && previousStatus !== input.status && input.reason) {
      await this.repo.createCorrection({
        attendanceRecordId: record.id,
        previousStatus,
        newStatus: input.status,
        reason: input.reason,
        correctedBy: actorId,
      });
    }

    await this.audit.log({
      actorId: input.actor.actorId,
      actorName: input.actor.actorName,
      actorRole: input.actor.actorRole,
      action: "MANUAL_MARK_ATTENDANCE",
      entityType: "ATTENDANCE_RECORD",
      entityId: record.id,
      description: `Manually marked student attendance as ${input.status} for session ${input.sessionId}`,
      oldValues: previousStatus ? { status: previousStatus } : undefined,
      newValues: { status: input.status, reason: input.reason },
      ipAddress: input.actor.ipAddress,
      userAgent: input.actor.userAgent,
    });

    return record;
  }
}
