import { pgTable, uuid, varchar, timestamp, uniqueIndex, boolean, text, pgEnum, integer } from 'drizzle-orm/pg-core';
import { staff } from './staff';
import { students } from './students';

export const directorySyncStatusEnum = pgEnum('directory_sync_status', ['RUNNING', 'SUCCEEDED', 'FAILED']);

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
    email: varchar('college_email', { length: 255 }),
    status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
    displayName: varchar('display_name', { length: 255 }),
    accountEnabled: boolean('account_enabled'),
    groupIds: text('group_ids').array().notNull().default([]),
    department: varchar('directory_department', { length: 255 }),
    academicBatch: varchar('academic_batch', { length: 255 }),
    academicClass: varchar('academic_class', { length: 255 }),
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
    return {
        tenantOidUnique: uniqueIndex('ext_identities_tenant_oid_idx').on(table.tenantId, table.oid),
    };
});

export const directorySyncRuns = pgTable('directory_sync_runs', {
    id: uuid('id').defaultRandom().primaryKey(),
    status: directorySyncStatusEnum('status').notNull().default('RUNNING'),
    mode: varchar('mode', { length: 20 }).notNull().default('FULL'),
    pagesProcessed: integer('pages_processed').notNull().default(0),
    usersScanned: integer('users_scanned').notNull().default(0),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
    failurePage: integer('failure_page'),
    errorCode: varchar('error_code', { length: 100 }),
    errorMessage: text('error_message'),
});

export const directorySyncRunMembers = pgTable('directory_sync_run_members', {
    runId: uuid('run_id').references(() => directorySyncRuns.id).notNull(),
    identityId: uuid('identity_id').references(() => externalIdentities.id).notNull(),
    displayName: varchar('display_name', { length: 255 }),
    email: varchar('college_email', { length: 255 }),
    department: varchar('directory_department', { length: 255 }),
    academicBatch: varchar('academic_batch', { length: 255 }),
    academicClass: varchar('academic_class', { length: 255 }),
    accountEnabled: boolean('account_enabled'),
    groupIds: text('group_ids').array().notNull().default([]),
    syncedAt: timestamp('synced_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    runIdentityUnique: uniqueIndex('directory_sync_run_members_run_identity_idx').on(table.runId, table.identityId),
}));
