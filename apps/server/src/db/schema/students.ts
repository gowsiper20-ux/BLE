import { pgTable, uuid, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { classes } from './academic';

export const studentStatusEnum = pgEnum('student_status', ['ACTIVE', 'INACTIVE', 'GRADUATED', 'SUSPENDED']);

export const students = pgTable('students', {
    id: uuid('id').defaultRandom().primaryKey(),
    registerNumber: varchar('register_number', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    collegeEmail: varchar('college_email', { length: 255 }).notNull().unique(),
    microsoftUserId: varchar('microsoft_user_id', { length: 255 }).unique(),
    classId: uuid('class_id').references(() => classes.id).notNull(),
    status: studentStatusEnum('status').default('ACTIVE').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
