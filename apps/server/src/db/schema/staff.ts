import { pgTable, uuid, varchar, timestamp, pgEnum, primaryKey, uniqueIndex } from 'drizzle-orm/pg-core';
import { classes, academicYears } from './academic';

export const staffStatusEnum = pgEnum('staff_status', ['ACTIVE', 'INACTIVE']);
export const classCounselorStatusEnum = pgEnum('counselor_status', ['ACTIVE', 'INACTIVE']);

export const staff = pgTable('staff', {
    id: uuid('id').defaultRandom().primaryKey(),
    staffCode: varchar('staff_code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    collegeEmail: varchar('college_email', { length: 255 }).notNull().unique(),
    microsoftUserId: varchar('microsoft_user_id', { length: 255 }).unique(),
    status: staffStatusEnum('status').default('ACTIVE').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const roles = pgTable('roles', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull().unique(),
    description: varchar('description', { length: 500 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const staffRoles = pgTable('staff_roles', {
    id: uuid('id').defaultRandom().primaryKey(),
    staffId: uuid('staff_id').references(() => staff.id).notNull(),
    roleId: uuid('role_id').references(() => roles.id).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
    return {
        staffRoleUnique: uniqueIndex('staff_role_idx').on(table.staffId, table.roleId),
    };
});

export const classCounselors = pgTable('class_counselors', {
    id: uuid('id').defaultRandom().primaryKey(),
    classId: uuid('class_id').references(() => classes.id).notNull(),
    staffId: uuid('staff_id').references(() => staff.id).notNull(),
    academicYearId: uuid('academic_year_id').references(() => academicYears.id).notNull(),
    status: classCounselorStatusEnum('status').default('ACTIVE').notNull(),
    assignedAt: timestamp('assigned_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
