import { pgTable, uuid, timestamp, varchar, date, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { timetables } from './timetable';
import { staff } from './staff';
import { sql } from 'drizzle-orm';

export const sessionStatusEnum = ['SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED'] as const;

export const attendanceSessions = pgTable('attendance_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  timetableId: uuid('timetable_id').notNull().references(() => timetables.id),
  sessionDate: date('session_date').notNull(),
  startedAt: timestamp('started_at', { mode: 'string' }),
  endedAt: timestamp('ended_at', { mode: 'string' }),
  status: varchar('status', { length: 20 }).notNull().$type<typeof sessionStatusEnum[number]>(),
  startedByStaffId: uuid('started_by_staff_id').references(() => staff.id),
  cancellationReason: text('cancellation_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    sessionUniqueIdx: uniqueIndex('session_unique_idx').on(table.timetableId, table.sessionDate),
  };
});
