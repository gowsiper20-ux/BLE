import { pgTable, uuid, timestamp, varchar, pgEnum, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { attendanceSessions } from './attendance';
import { students } from './students';
import { staff } from './staff';

export const attendanceRecordStatusEnum = pgEnum('attendance_record_status', ['PRESENT', 'ABSENT', 'LATE', 'MANUAL']);
export const attendanceRecordSourceEnum = pgEnum('attendance_record_source', ['BLE', 'MANUAL']);

export const attendanceRecords = pgTable('attendance_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  attendanceSessionId: uuid('attendance_session_id').notNull().references(() => attendanceSessions.id),
  studentId: uuid('student_id').notNull().references(() => students.id),
  status: attendanceRecordStatusEnum('status').notNull(),
  source: attendanceRecordSourceEnum('source').notNull(),
  firstDetectedAt: timestamp('first_detected_at', { mode: 'string' }),
  lastDetectedAt: timestamp('last_detected_at', { mode: 'string' }),
  detectionCount: integer('detection_count').default(0).notNull(),
  markedAt: timestamp('marked_at', { mode: 'string' }).notNull(),
  markedBy: uuid('marked_by').references(() => staff.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    recordUniqueIdx: uniqueIndex('record_session_student_idx').on(table.attendanceSessionId, table.studentId),
  };
});
