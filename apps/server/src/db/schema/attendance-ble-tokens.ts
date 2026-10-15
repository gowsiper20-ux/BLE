import { pgTable, uuid, timestamp, varchar, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { attendanceSessions } from './attendance';
import { students } from './students';

export const bleTokenStatusEnum = pgEnum('ble_token_status', ['ACTIVE', 'EXPIRED', 'REVOKED']);

export const attendanceBleTokens = pgTable('attendance_ble_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  attendanceSessionId: uuid('attendance_session_id').notNull().references(() => attendanceSessions.id),
  studentId: uuid('student_id').notNull().references(() => students.id),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  issuedAt: timestamp('issued_at', { mode: 'string' }).notNull(),
  expiresAt: timestamp('expires_at', { mode: 'string' }).notNull(),
  status: bleTokenStatusEnum('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    sessionStudentUniqueIdx: uniqueIndex('token_session_student_idx').on(table.attendanceSessionId, table.studentId),
    tokenHashIdx: index('token_hash_idx').on(table.tokenHash),
  };
});
