import { pgTable, uuid, timestamp, varchar, text, jsonb } from 'drizzle-orm/pg-core';
import { staff } from './staff';

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: uuid('actor_id').references(() => staff.id),
  actorName: varchar('actor_name', { length: 255 }),
  actorRole: varchar('actor_role', { length: 50 }),
  action: varchar('action', { length: 50 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: varchar('entity_id', { length: 100 }),
  description: text('description').notNull(),
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
