import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const systemSettings = pgTable('system_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: varchar('category', { length: 50 }).notNull(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: text('value').notNull(), // Store JSON stringified values or plain string
  type: varchar('type', { length: 20 }).notNull().default('string'), // string, number, boolean, json
  description: text('description'),
  updatedBy: uuid('updated_by'), // Staff ID
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
