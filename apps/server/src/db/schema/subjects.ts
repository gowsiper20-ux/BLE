import { pgTable, uuid, varchar, text, timestamp, boolean, integer, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { regulations, academicYears, classes } from './academic';

// Subject Types
export const subjectTypes = ['THEORY', 'LAB', 'ELECTIVE', 'PROJECT', 'SEMINAR'] as const;
export type SubjectType = typeof subjectTypes[number];

// Subject Statuses
export const subjectStatuses = ['ACTIVE', 'INACTIVE'] as const;
export type SubjectStatus = typeof subjectStatuses[number];

export const subjects = pgTable('subjects', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  subjectType: varchar('subject_type', { length: 50 }).notNull(), // THEORY, LAB, etc.
  yearNumber: integer('year_number').notNull(),
  regulationId: uuid('regulation_id').references(() => regulations.id).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const classSubjects = pgTable('class_subjects', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id').references(() => classes.id).notNull(),
  subjectId: uuid('subject_id').references(() => subjects.id).notNull(),
  academicYearId: uuid('academic_year_id').references(() => academicYears.id).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => {
  return {
    classSubjectUniqueIndex: uniqueIndex('class_subject_unique_idx').on(table.classId, table.subjectId, table.academicYearId)
  };
});
