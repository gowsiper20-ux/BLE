import { AttendanceSessionRepository } from '../repositories/attendanceSession.repository';
import { TimetableRepository } from '../repositories/timetable.repository';
import { TimetableOverrideRepository } from '../repositories/timetable-override.repository';
import { StaffRepository } from '../repositories/staff.repository';
import { PeriodRepository } from '../repositories/period.repository';

// Start window: 10 mins before period starts
const ATTENDANCE_START_EARLY_MINUTES = parseInt(process.env.ATTENDANCE_START_EARLY_MINUTES || '10', 10);

export class AttendanceSessionService {
  private repo = new AttendanceSessionRepository();
  private timetableRepo = new TimetableRepository();
  private overrideRepo = new TimetableOverrideRepository();
  private staffRepo = new StaffRepository();
  private periodRepo = new PeriodRepository();

  private getDayName(dateStr: string) {
    const d = new Date(dateStr);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[d.getDay()];
  }

  private timeToMinutes(timeStr: string) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  async startSession(timetableId: string, staffId: string, dateStr: string) {
    // 1. Timetable exists
    const timetable = await this.timetableRepo.findById(timetableId);
    if (!timetable) throw new Error("TIMETABLE_NOT_FOUND");
    if (timetable.status !== 'ACTIVE') throw new Error("TIMETABLE_INACTIVE");

    // 2. Validate day of week matches date
    const dayName = this.getDayName(dateStr);
    if (timetable.dayOfWeek !== dayName) throw new Error("INVALID_TIMETABLE_DAY");

    const override = await this.overrideRepo.findByTimetableAndDate(timetableId, dateStr);
    const effectiveStaffId = override?.replacementStaffId || timetable.staffId;
    const effectiveSubjectId = override?.replacementSubjectId || timetable.subjectId;

    // 4. Validate authorized staff
    if (effectiveStaffId !== staffId) throw new Error("STAFF_NOT_AUTHORIZED");

    // Validate staff is active
    const staff = await this.staffRepo.getStaffById(staffId);
    if (!staff || staff.status !== 'ACTIVE') throw new Error("STAFF_INACTIVE");

    // 5. Time window validation
    const period = await this.periodRepo.findById(timetable.periodId);
    if (!period || period.status !== 'ACTIVE') throw new Error("PERIOD_INACTIVE");

    const now = new Date();
    // Assuming dateStr is today for accurate time checking.
    // In production we should timezone handle this.
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const startMins = this.timeToMinutes(period.startTime);
    const endMins = this.timeToMinutes(period.endTime);

    if (currentMins < startMins - ATTENDANCE_START_EARLY_MINUTES) {
      throw new Error("SESSION_NOT_IN_START_WINDOW");
    }

    // 6. Check duplicate session
    const existing = await this.repo.findByTimetableAndDate(timetableId, dateStr);
    if (existing) {
      if (existing.status === 'CANCELLED') {
        throw new Error("SESSION_CANCELLED");
      }
      throw new Error("SESSION_ALREADY_EXISTS");
    }

    // 7. Create Session
    return await this.repo.create({
      timetableId,
      sessionDate: dateStr,
      startedAt: now.toISOString(),
      status: 'ACTIVE',
      startedByStaffId: staffId,
    });
  }

  async endSession(id: string) {
    const session = await this.repo.findById(id);
    if (!session) throw new Error("SESSION_NOT_FOUND");
    if (session.status !== 'ACTIVE') throw new Error("SESSION_NOT_ACTIVE");

    return await this.repo.update(id, {
      status: 'COMPLETED',
      endedAt: new Date().toISOString()
    });
  }

  async cancelSession(id: string, reason: string) {
    if (!reason) throw new Error("REASON_REQUIRED");
    const session = await this.repo.findById(id);
    if (!session) throw new Error("SESSION_NOT_FOUND");
    if (session.status === 'COMPLETED') throw new Error("CANNOT_CANCEL_COMPLETED_SESSION");

    return await this.repo.update(id, {
      status: 'CANCELLED',
      cancellationReason: reason,
      endedAt: session.status === 'ACTIVE' ? new Date().toISOString() : null
    });
  }

  async getSession(id: string) {
    return await this.repo.findById(id);
  }

  async getSessions(filters: any) {
    return await this.repo.findAll(filters);
  }

  async getStats(dateStr: string) {
    const sessions = await this.repo.findAll({ date: dateStr });
    let scheduled = 0; // We need to calculate this from timetables for the day
    let active = 0;
    let completed = 0;
    let cancelled = 0;
    let expired = 0;

    sessions.forEach(s => {
      if (s.status === 'ACTIVE') active++;
      if (s.status === 'COMPLETED') completed++;
      if (s.status === 'CANCELLED') cancelled++;
      if (s.status === 'EXPIRED') expired++;
    });

    return {
      totalToday: sessions.length, // Only created sessions for now
      scheduledToday: scheduled, 
      activeToday: active,
      completedToday: completed,
      cancelledToday: cancelled,
      expiredToday: expired
    };
  }
}
