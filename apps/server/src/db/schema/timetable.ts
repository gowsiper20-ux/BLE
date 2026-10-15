import { pgTable, uuid, varchar, text, timestamp, integer, uniqueIndex, time, date } from 'drizzle-orm/pg-core';
import { classes, academicYears } from './academic';
import { subjects } from './subjects';
import { staff } from './staff';

export const dayOfWeekEnum = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;
export type DayOfWeek = typeof dayOfWeekEnum[number];

export const periods = pgTable('periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  periodNumber: integer('period_number').notNull().unique(),
  name: varchar('name', { length: 50 }).notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});


export const timetables = pgTable('timetables', {
  id: uuid('id').primaryKey().defaultRandom(),
  academicYearId: uuid('academic_year_id').references(() => academicYears.id).notNull(),
  classId: uuid('class_id').references(() => classes.id).notNull(),
  dayOfWeek: varchar('day_of_week', { length: 50 }).notNull(),
  periodId: uuid('period_id').references(() => periods.id).notNull(),
  subjectId: uuid('subject_id').references(() => subjects.id).notNull(),
  staffId: uuid('staff_id').references(() => staff.id).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => {
  return {
    classConflictIdx: uniqueIndex('class_conflict_idx').on(table.academicYearId, table.classId, table.dayOfWeek, table.periodId),
    staffConflictIdx: uniqueIndex('staff_conflict_idx').on(table.academicYearId, table.staffId, table.dayOfWeek, table.periodId)
  };
});

export const timetableOverrides = pgTable('timetable_overrides', {
  id: uuid('id').primaryKey().defaultRandom(),
  timetableId: uuid('timetable_id').references(() => timetables.id).notNull(),
  overrideDate: date('override_date').notNull(),
  replacementStaffId: uuid('replacement_staff_id').references(() => staff.id),
  replacementSubjectId: uuid('replacement_subject_id').references(() => subjects.id),
  reason: text('reason'),
  status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});
