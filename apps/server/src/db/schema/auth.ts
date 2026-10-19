import { pgTable, uuid, varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { staff } from './staff';
import { students } from './students';

export const staffCredentials = pgTable('staff_credentials', {
    id: uuid('id').defaultRandom().primaryKey(),
    staffId: uuid('staff_id').references(() => staff.id).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const externalIdentities = pgTable('external_identities', {
    id: uuid('id').defaultRandom().primaryKey(),
    staffId: uuid('staff_id').references(() => staff.id),
    studentId: uuid('student_id').references(() => students.id),
    provider: varchar('provider', { length: 50 }).notNull().default('MICROSOFT'),
    tenantId: varchar('tenant_id', { length: 255 }).notNull(),
    oid: varchar('oid', { length: 255 }).notNull(),
    email: varchar('college_email', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
    return {
        tenantOidUnique: uniqueIndex('ext_identities_tenant_oid_idx').on(table.tenantId, table.oid),
    };
});
