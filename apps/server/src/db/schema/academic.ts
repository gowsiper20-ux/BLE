import { pgTable, uuid, varchar, timestamp, boolean, integer, text, pgEnum, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const statusEnum = pgEnum('status', ['ACTIVE', 'INACTIVE']);

export const departments = pgTable('departments', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    status: statusEnum('status').default('ACTIVE').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const academicYears = pgTable('academic_years', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 50 }).notNull().unique(),
    startDate: timestamp('start_date', { mode: 'date' }).notNull(),
    endDate: timestamp('end_date', { mode: 'date' }).notNull(),
    isCurrent: boolean('is_current').default(false).notNull(),
    status: statusEnum('status').default('ACTIVE').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const batches = pgTable('batches', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 50 }).notNull(),
    startYear: integer('start_year').notNull(),
    endYear: integer('end_year').notNull(),
    departmentId: uuid('department_id').references(() => departments.id).notNull(),
    status: statusEnum('status').default('ACTIVE').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const regulations = pgTable('regulations', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    year: integer('year').notNull(),
    description: text('description'),
    status: statusEnum('status').default('ACTIVE').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const classes = pgTable('classes', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    yearNumber: integer('year_number').notNull(),
    section: varchar('section', { length: 10 }).notNull(),
    departmentId: uuid('department_id').references(() => departments.id).notNull(),
    academicYearId: uuid('academic_year_id').references(() => academicYears.id).notNull(),
    batchId: uuid('batch_id').references(() => batches.id).notNull(),
    regulationId: uuid('regulation_id').references(() => regulations.id).notNull(),
    status: statusEnum('status').default('ACTIVE').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
    unq: unique().on(t.departmentId, t.academicYearId, t.yearNumber, t.section),
}));
