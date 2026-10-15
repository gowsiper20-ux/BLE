import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { staff } from './staff';

export const staffCredentials = pgTable('staff_credentials', {
    id: uuid('id').defaultRandom().primaryKey(),
    staffId: uuid('staff_id').references(() => staff.id).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
