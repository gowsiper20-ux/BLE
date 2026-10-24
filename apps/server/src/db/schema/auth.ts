import { pgTable, uuid, varchar, timestamp, uniqueIndex, boolean, text, pgEnum, integer, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { staff } from './staff';
import { students } from './students';

export const directorySyncStatusEnum = pgEnum('directory_sync_status', ['RUNNING', 'SUCCEEDED', 'FAILED']);

export const staffCredentials = pgTable('staff_credentials', {
    id: uuid('id').defaultRandom().primaryKey(),
    staffId: uuid('staff_id').references(() => staff.id).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    sessionVersion: integer('session_version').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const facultyAuthAccounts = pgTable('faculty_auth_accounts', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 254 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: varchar('role', { length: 30 }).notNull().default('FACULTY'),
    status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
    sessionVersion: integer('session_version').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    normalizedEmailUnique: uniqueIndex('faculty_auth_accounts_email_lower_unique_idx').on(sql`lower(${table.email})`),
    facultyRoleOnly: check('faculty_auth_accounts_role_check', sql`${table.role} = 'FACULTY'`),
    accountStatusCheck: check('faculty_auth_accounts_status_check', sql`${table.status} in ('ACTIVE', 'INACTIVE')`),
}));

export const staffApprovalRequests = pgTable('staff_approval_requests', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 254 }).notNull().unique(),
    staffCode: varchar('staff_code', { length: 50 }),
    department: varchar('department', { length: 100 }).default('Information Technology'),
    designation: varchar('designation', { length: 100 }).default('Assistant Professor'),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('PENDING'),
    rejectionReason: text('rejection_reason'),
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
    userPrincipalName: varchar('user_principal_name', { length: 255 }),
    status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
    displayName: varchar('display_name', { length: 255 }),
    jobTitle: varchar('job_title', { length: 255 }),
    accountEnabled: boolean('account_enabled'),
    groupIds: text('group_ids').array().notNull().default([]),
    department: varchar('directory_department', { length: 255 }),
    academicBatch: varchar('academic_batch', { length: 255 }),
    academicClass: varchar('academic_class', { length: 255 }),
    source: varchar('source', { length: 50 }).notNull().default('LEGACY_UNVERIFIED'),
    isPresent: boolean('is_present').notNull().default(false),
    lastSeenAt: timestamp('last_seen_at'),
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
    snapshotId: varchar('snapshot_id', { length: 100 }),
    schemaVersion: varchar('schema_version', { length: 20 }),
    source: varchar('source', { length: 50 }).notNull().default('LEGACY_UNVERIFIED'),
    exportedAt: timestamp('exported_at'),
    ingestedAt: timestamp('ingested_at'),
    completeSnapshot: boolean('complete_snapshot').notNull().default(false),
    membershipMode: varchar('membership_mode', { length: 20 }),
    payloadSha256: varchar('payload_sha256', { length: 64 }),
    pagesProcessed: integer('pages_processed').notNull().default(0),
    usersScanned: integer('users_scanned').notNull().default(0),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
    failurePage: integer('failure_page'),
    errorCode: varchar('error_code', { length: 100 }),
    errorMessage: text('error_message'),
}, (table) => ({
    snapshotIdUnique: uniqueIndex('directory_sync_runs_snapshot_id_unique_idx').on(table.snapshotId),
    latestSourceIndex: index('directory_sync_runs_source_status_exported_idx').on(table.source, table.status, table.exportedAt),
}));

export const directorySyncRunMembers = pgTable('directory_sync_run_members', {
    runId: uuid('run_id').references(() => directorySyncRuns.id).notNull(),
    identityId: uuid('identity_id').references(() => externalIdentities.id).notNull(),
    displayName: varchar('display_name', { length: 255 }),
    email: varchar('college_email', { length: 255 }),
    userPrincipalName: varchar('user_principal_name', { length: 255 }),
    department: varchar('directory_department', { length: 255 }),
    jobTitle: varchar('job_title', { length: 255 }),
    academicBatch: varchar('academic_batch', { length: 255 }),
    academicClass: varchar('academic_class', { length: 255 }),
    accountEnabled: boolean('account_enabled'),
    groupIds: text('group_ids').array().notNull().default([]),
    syncedAt: timestamp('synced_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    runIdentityUnique: uniqueIndex('directory_sync_run_members_run_identity_idx').on(table.runId, table.identityId),
}));
