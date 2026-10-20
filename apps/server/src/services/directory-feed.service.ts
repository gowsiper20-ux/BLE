import { createHash } from "node:crypto";
import { and, asc, desc, eq, ilike, isNotNull, or, sql } from "drizzle-orm";
import { db } from "../db";
import { auditLogs } from "../db/schema/audit";
import {
  directorySyncRunMembers,
  directorySyncRuns,
  externalIdentities,
} from "../db/schema/auth";
import {
  DirectoryFeedError,
  getDirectoryFeedConfiguration,
  isDirectoryFeedConfigured,
  validateDirectoryFeedSnapshot,
  verifyDirectoryFeedSignature,
  type DirectoryFeedSnapshot,
} from "./directory-feed";
import { getDirectoryGroupConfiguration } from "./directory-classification";

const FEED_SOURCE = "COLLEGE_AUTHORIZED_FEED";
const IMPORT_BATCH_SIZE = 250;

type SortField = "displayName" | "email" | "academicBatch" | "academicClass" | "accountEnabled";

function groupOverlap(groupIds: string[]) {
  return groupIds.length
    ? sql`${directorySyncRunMembers.groupIds} && ARRAY[${sql.join(groupIds.map((id) => sql`${id}`), sql`, `)}]::text[]`
    : sql`false`;
}

function safeFailure(error: unknown): { code: string; message: string } {
  if (error instanceof DirectoryFeedError) {
    return { code: error.code, message: error.message };
  }
  if (error && typeof error === "object" && "code" in error && error.code === "23505") {
    return { code: "SNAPSHOT_REPLAY", message: "Snapshot ID has already been recorded." };
  }
  return {
    code: "DIRECTORY_INGESTION_FAILED",
    message: "Directory snapshot ingestion failed; the last accepted snapshot was preserved.",
  };
}

export class DirectoryFeedService {
  private isImporting = false;

  async getDirectoryStatus() {
    const configuration = getDirectoryFeedConfiguration();
    const groupConfiguration = getDirectoryGroupConfiguration();
    const configured = isDirectoryFeedConfigured(configuration);
    const [lastSuccessfulRun] = await db.select().from(directorySyncRuns)
      .where(and(
        eq(directorySyncRuns.status, "SUCCEEDED"),
        eq(directorySyncRuns.source, FEED_SOURCE),
        eq(directorySyncRuns.completeSnapshot, true),
      ))
      .orderBy(desc(directorySyncRuns.exportedAt))
      .limit(1);
    const [latestRun] = await db.select({
      id: directorySyncRuns.id,
      status: directorySyncRuns.status,
      snapshotId: directorySyncRuns.snapshotId,
      startedAt: directorySyncRuns.startedAt,
      completedAt: directorySyncRuns.completedAt,
      exportedAt: directorySyncRuns.exportedAt,
      ingestedAt: directorySyncRuns.ingestedAt,
      usersScanned: directorySyncRuns.usersScanned,
      errorCode: directorySyncRuns.errorCode,
      errorMessage: directorySyncRuns.errorMessage,
    }).from(directorySyncRuns)
      .where(eq(directorySyncRuns.source, FEED_SOURCE))
      .orderBy(desc(directorySyncRuns.startedAt))
      .limit(1);

    const [totals] = lastSuccessfulRun
      ? await db.select({
        total: sql<number>`cast(count(*) as integer)`,
        disabled: sql<number>`cast(count(*) filter (where ${directorySyncRunMembers.accountEnabled} = false) as integer)`,
      }).from(directorySyncRunMembers).where(eq(directorySyncRunMembers.runId, lastSuccessfulRun.id))
      : [{ total: null, disabled: null }];

    const mappingsMatchSnapshot = Boolean(
      lastSuccessfulRun &&
      groupConfiguration.membershipMode &&
      groupConfiguration.membershipMode === lastSuccessfulRun.membershipMode,
    );
    const studentGroups = groupConfiguration.itStudentGroupIds;
    const staffGroups = groupConfiguration.itStaffGroupIds;
    const studentOverlap = groupOverlap(studentGroups);
    const staffOverlap = groupOverlap(staffGroups);
    const hasCompleteGroupMapping = mappingsMatchSnapshot && studentGroups.length > 0 && staffGroups.length > 0;
    const hasStudentMapping = hasCompleteGroupMapping;
    const hasStaffMapping = hasCompleteGroupMapping;
    const bothMappings = hasStudentMapping && hasStaffMapping;
    const countMembers = async (condition: ReturnType<typeof sql>) => {
      if (!lastSuccessfulRun) return null;
      const [result] = await db.select({ count: sql<number>`cast(count(*) as integer)` })
        .from(directorySyncRunMembers)
        .where(and(eq(directorySyncRunMembers.runId, lastSuccessfulRun.id), condition));
      return Number(result?.count || 0);
    };

    const [studentsCount, staffCount, conflictsCount, unclassifiedCount, batchCount, classCount] = await Promise.all([
      hasStudentMapping
        ? countMembers(and(studentOverlap, bothMappings ? sql`NOT (${staffOverlap})` : sql`true`) as ReturnType<typeof sql>)
        : Promise.resolve(null),
      hasStaffMapping
        ? countMembers(and(staffOverlap, bothMappings ? sql`NOT (${studentOverlap})` : sql`true`) as ReturnType<typeof sql>)
        : Promise.resolve(null),
      bothMappings
        ? countMembers(and(studentOverlap, staffOverlap) as ReturnType<typeof sql>)
        : Promise.resolve(null),
      mappingsMatchSnapshot && (hasStudentMapping || hasStaffMapping)
        ? countMembers(and(
          sql`NOT (${hasStudentMapping ? studentOverlap : sql`false`})`,
          sql`NOT (${hasStaffMapping ? staffOverlap : sql`false`})`,
        ) as ReturnType<typeof sql>)
        : Promise.resolve(null),
      hasStudentMapping
        ? countMembers(and(studentOverlap, isNotNull(directorySyncRunMembers.academicBatch)) as ReturnType<typeof sql>)
        : Promise.resolve(null),
      hasStudentMapping
        ? countMembers(and(studentOverlap, isNotNull(directorySyncRunMembers.academicClass)) as ReturnType<typeof sql>)
        : Promise.resolve(null),
    ]);

    const ingestedAt = lastSuccessfulRun?.ingestedAt ?? null;
    const sourceExportedAt = lastSuccessfulRun?.exportedAt ?? null;
    const staleThresholdMs = configuration.staleAfterMinutes * 60_000;
    const freshness = !lastSuccessfulRun
      ? "UNAVAILABLE"
      : sourceExportedAt && Date.now() - sourceExportedAt.getTime() > staleThresholdMs
        ? "STALE"
        : "CURRENT";
    const failures = await db.select({
      status: directorySyncRuns.status,
      snapshotId: directorySyncRuns.snapshotId,
      startedAt: directorySyncRuns.startedAt,
      completedAt: directorySyncRuns.completedAt,
      exportedAt: directorySyncRuns.exportedAt,
      errorCode: directorySyncRuns.errorCode,
      errorMessage: directorySyncRuns.errorMessage,
    }).from(directorySyncRuns)
      .where(and(eq(directorySyncRuns.source, FEED_SOURCE), eq(directorySyncRuns.status, "FAILED")))
      .orderBy(desc(directorySyncRuns.startedAt))
      .limit(5);
    const studentGroupIdsConfigured = studentGroups.length > 0;
    const staffGroupIdsConfigured = staffGroups.length > 0;

    return {
      configured,
      source: configured ? "College-authorized Microsoft Entra snapshot feed" : "Not configured",
      totalSynchronizedUsers: lastSuccessfulRun ? Number(totals?.total || 0) : null,
      verifiedItStudentIdentities: hasStudentMapping ? studentsCount : null,
      verifiedItFacultyStaffIdentities: hasStaffMapping ? staffCount : null,
      conflictingGroupClassifications: bothMappings ? conflictsCount : null,
      unclassifiedUsers: hasCompleteGroupMapping ? unclassifiedCount : null,
      disabledAccounts: lastSuccessfulRun ? Number(totals?.disabled || 0) : null,
      sourceProvidedBatchValues: batchCount,
      sourceProvidedClassValues: classCount,
      verifiedGroupClassifications: hasCompleteGroupMapping,
      membershipMode: mappingsMatchSnapshot ? groupConfiguration.membershipMode : null,
      studentGroupIdsConfigured,
      staffGroupIdsConfigured,
      classificationMappings: {
        membershipMode: groupConfiguration.membershipMode,
        studentGroupIds: studentGroups,
        staffGroupIds: staffGroups,
      },
      groupMembershipModeConfigured: Boolean(groupConfiguration.membershipMode),
      lastSuccessfulFullSync: ingestedAt?.toISOString() ?? null,
      lastSuccessfulExportAt: sourceExportedAt?.toISOString() ?? null,
      lastSuccessfulIngestionAt: ingestedAt?.toISOString() ?? null,
      lastSuccessfulSnapshotId: lastSuccessfulRun?.snapshotId ?? null,
      lastSyncCounts: lastSuccessfulRun ? { usersScanned: lastSuccessfulRun.usersScanned } : null,
      latestAttempt: latestRun || null,
      failures,
      freshness,
      staleAfterMinutes: configuration.staleAfterMinutes,
      classification: mappingsMatchSnapshot
        ? "Classification uses configured immutable group object IDs with the snapshot's declared membership semantics."
        : "Classification is unavailable until approved group IDs and matching membership semantics are configured.",
      academicAttributesConfigured: false,
      sourceProvidedAcademicBatchCount: batchCount,
      sourceProvidedAcademicClassCount: classCount,
    };
  }

  async getItStudents(filters: {
    search?: string;
    academicBatch?: string;
    academicClass?: string;
    accountStatus?: "enabled" | "disabled" | "unknown";
    page?: number;
    limit?: number;
    sortBy?: SortField;
    sortOrder?: "asc" | "desc";
  }) {
    return this.getDirectoryMembers("student", filters);
  }

  async getItStaff(filters: {
    search?: string;
    accountStatus?: "enabled" | "disabled" | "unknown";
    page?: number;
    limit?: number;
    sortBy?: SortField;
    sortOrder?: "asc" | "desc";
  }) {
    return this.getDirectoryMembers("staff", filters);
  }

  private async getCurrentSnapshot() {
    const [run] = await db.select().from(directorySyncRuns)
      .where(and(
        eq(directorySyncRuns.status, "SUCCEEDED"),
        eq(directorySyncRuns.source, FEED_SOURCE),
        eq(directorySyncRuns.completeSnapshot, true),
      ))
      .orderBy(desc(directorySyncRuns.exportedAt))
      .limit(1);
    return run || null;
  }

  private async getDirectoryMembers(
    classification: "student" | "staff",
    filters: {
      search?: string;
      academicBatch?: string;
      academicClass?: string;
      accountStatus?: "enabled" | "disabled" | "unknown";
      page?: number;
      limit?: number;
      sortBy?: SortField;
      sortOrder?: "asc" | "desc";
    },
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("INVALID_PAGINATION: page must be positive and limit must be 1-100.");
    }
    const search = filters.search?.trim();
    if (search && search.length > 150) throw new Error("INVALID_SEARCH: search must be no longer than 150 characters.");

    const snapshot = await this.getCurrentSnapshot();
    const configuration = getDirectoryGroupConfiguration();
    const groupIds = classification === "student"
      ? configuration.itStudentGroupIds
      : configuration.itStaffGroupIds;
    const opposingGroupIds = classification === "student"
      ? configuration.itStaffGroupIds
      : configuration.itStudentGroupIds;
    const membershipMatches = Boolean(
      snapshot &&
      configuration.membershipMode === snapshot.membershipMode &&
      configuration.itStudentGroupIds.length > 0 &&
      configuration.itStaffGroupIds.length > 0,
    );
    const baseConditions = [
      snapshot ? eq(directorySyncRunMembers.runId, snapshot.id) : sql`false`,
      membershipMatches && groupIds.length
        ? groupOverlap(groupIds)
        : sql`false`,
      membershipMatches && groupIds.length && opposingGroupIds.length
        ? sql`NOT (${groupOverlap(opposingGroupIds)})`
        : undefined,
    ];
    const queryConditions = [...baseConditions];
    if (search) {
      const pattern = `%${search}%`;
      queryConditions.push(or(
        ilike(directorySyncRunMembers.displayName, pattern),
        ilike(directorySyncRunMembers.email, pattern),
        ilike(directorySyncRunMembers.userPrincipalName, pattern),
      )!);
    }
    if (filters.academicBatch) queryConditions.push(eq(directorySyncRunMembers.academicBatch, filters.academicBatch));
    if (filters.academicClass) queryConditions.push(eq(directorySyncRunMembers.academicClass, filters.academicClass));
    if (filters.accountStatus === "enabled") queryConditions.push(eq(directorySyncRunMembers.accountEnabled, true));
    if (filters.accountStatus === "disabled") queryConditions.push(eq(directorySyncRunMembers.accountEnabled, false));
    if (filters.accountStatus === "unknown") queryConditions.push(sql`${directorySyncRunMembers.accountEnabled} IS NULL`);
    const sortColumns = {
      displayName: directorySyncRunMembers.displayName,
      email: directorySyncRunMembers.email,
      academicBatch: directorySyncRunMembers.academicBatch,
      academicClass: directorySyncRunMembers.academicClass,
      accountEnabled: directorySyncRunMembers.accountEnabled,
    };
    const sortColumn = sortColumns[filters.sortBy || "displayName"];
    const sortDirection = filters.sortOrder === "desc" ? desc : asc;
    const whereClause = and(...queryConditions);
    const [identities, [countResult], [filterValues]] = await Promise.all([
      db.select({
        id: directorySyncRunMembers.identityId,
        displayName: directorySyncRunMembers.displayName,
        email: directorySyncRunMembers.email,
        userPrincipalName: directorySyncRunMembers.userPrincipalName,
        department: directorySyncRunMembers.department,
        jobTitle: directorySyncRunMembers.jobTitle,
        academicBatch: directorySyncRunMembers.academicBatch,
        academicClass: directorySyncRunMembers.academicClass,
        accountEnabled: directorySyncRunMembers.accountEnabled,
        lastSyncedAt: directorySyncRunMembers.syncedAt,
      }).from(directorySyncRunMembers)
        .where(whereClause)
        .orderBy(sortDirection(sortColumn), asc(directorySyncRunMembers.identityId))
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ count: sql<number>`cast(count(*) as integer)` })
        .from(directorySyncRunMembers)
        .where(whereClause),
      db.select({
        batches: sql<string[]>`array_remove(array_agg(distinct ${directorySyncRunMembers.academicBatch}), NULL)`,
        classes: sql<string[]>`array_remove(array_agg(distinct ${directorySyncRunMembers.academicClass}), NULL)`,
      }).from(directorySyncRunMembers).where(and(...baseConditions)),
    ]);
    const total = Number(countResult?.count || 0);

    return {
      identities,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      filters: { batches: filterValues?.batches || [], classes: filterValues?.classes || [] },
      classificationConfigured: Boolean(
        membershipMatches &&
        configuration.itStudentGroupIds.length > 0 &&
        configuration.itStaffGroupIds.length > 0 &&
        groupIds.length,
      ),
      academicAttributesConfigured: false,
      batchAttributeConfigured: false,
      classAttributeConfigured: false,
    };
  }

  async getUnresolvedIdentities(limit = 50, page = 1) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(page) || page < 1) {
      throw new Error("INVALID_PAGINATION: limit must be 1-100 and page must be positive.");
    }
    const snapshot = await this.getCurrentSnapshot();
    const configuration = getDirectoryGroupConfiguration();
    const studentGroups = groupOverlap(configuration.itStudentGroupIds);
    const staffGroups = groupOverlap(configuration.itStaffGroupIds);
    const mappingsMatch = Boolean(
      snapshot &&
      configuration.membershipMode === snapshot.membershipMode &&
      configuration.itStudentGroupIds.length > 0 &&
      configuration.itStaffGroupIds.length > 0,
    );
    const conditions = [
      snapshot ? eq(directorySyncRunMembers.runId, snapshot.id) : sql`false`,
      mappingsMatch && configuration.itStudentGroupIds.length > 0 && configuration.itStaffGroupIds.length > 0
        ? and(sql`NOT (${studentGroups})`, sql`NOT (${staffGroups})`)
        : sql`true`,
    ];
    const [data, [countResult]] = await Promise.all([
      db.select({
        id: directorySyncRunMembers.identityId,
        displayName: directorySyncRunMembers.displayName,
        email: directorySyncRunMembers.email,
        userPrincipalName: directorySyncRunMembers.userPrincipalName,
        department: directorySyncRunMembers.department,
        jobTitle: directorySyncRunMembers.jobTitle,
        accountEnabled: directorySyncRunMembers.accountEnabled,
        groupIds: directorySyncRunMembers.groupIds,
      }).from(directorySyncRunMembers)
        .where(and(...conditions))
        .orderBy(asc(directorySyncRunMembers.displayName))
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ count: sql<number>`cast(count(*) as integer)` })
        .from(directorySyncRunMembers)
        .where(and(...conditions)),
    ]);
    const total = Number(countResult?.count || 0);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async ingestSnapshot(rawBody: Buffer, timestampHeader: string | undefined, signatureHeader: string | undefined) {
    const configuration = getDirectoryFeedConfiguration();
    const deadline = Date.now() + configuration.maxProcessingTimeMs;
    if (rawBody.byteLength > configuration.maxBodyBytes) {
      throw new DirectoryFeedError("Snapshot exceeds the configured request-size limit.", "PAYLOAD_TOO_LARGE", 413);
    }
    verifyDirectoryFeedSignature(rawBody, timestampHeader, signatureHeader, configuration);

    const payloadSha256 = createHash("sha256").update(rawBody).digest("hex");
    let snapshot: DirectoryFeedSnapshot;
    try {
      let parsedPayload: unknown;
      try {
        parsedPayload = JSON.parse(rawBody.toString("utf8"));
      } catch {
        throw new DirectoryFeedError("Request body is not valid JSON.", "INVALID_JSON", 400);
      }
      snapshot = validateDirectoryFeedSnapshot(parsedPayload, configuration);
      if (Date.now() > deadline) {
        throw new DirectoryFeedError("Directory snapshot processing exceeded its time limit.", "PROCESSING_TIMEOUT", 503);
      }
    } catch (error) {
      const failure = safeFailure(error);
      await db.insert(directorySyncRuns).values({
        status: "FAILED",
        mode: "FULL",
        source: FEED_SOURCE,
        payloadSha256,
        startedAt: new Date(),
        completedAt: new Date(),
        errorCode: failure.code,
        errorMessage: failure.message,
      });
      throw error;
    }
    const [previousAttempt] = await db.select({
      status: directorySyncRuns.status,
      payloadSha256: directorySyncRuns.payloadSha256,
    }).from(directorySyncRuns)
      .where(eq(directorySyncRuns.snapshotId, snapshot.snapshotId))
      .limit(1);
    if (previousAttempt) {
      if (previousAttempt.status === "SUCCEEDED" && previousAttempt.payloadSha256 === payloadSha256) {
        return {
          success: true,
          duplicate: true,
          snapshotId: snapshot.snapshotId,
          usersScanned: snapshot.users.length,
          message: "This snapshot was already accepted; no data was changed.",
        };
      }
      throw new DirectoryFeedError("Snapshot ID has already been used.", "SNAPSHOT_REPLAY", 409);
    }
    if (this.isImporting) {
      throw new DirectoryFeedError("A directory snapshot import is already running.", "IMPORT_IN_PROGRESS", 409);
    }

    this.isImporting = true;
    const startedAt = new Date();
    let runId: string | undefined;
    try {
      const [run] = await db.insert(directorySyncRuns).values({
        status: "RUNNING",
        mode: "FULL",
        snapshotId: snapshot.snapshotId,
        schemaVersion: snapshot.schemaVersion,
        source: FEED_SOURCE,
        exportedAt: new Date(snapshot.exportedAt),
        completeSnapshot: true,
        membershipMode: snapshot.membershipMode,
        payloadSha256,
        usersScanned: snapshot.users.length,
        startedAt,
      }).returning({ id: directorySyncRuns.id });
      runId = run.id;
      await this.reconcileSnapshot(run.id, snapshot, payloadSha256, deadline);
      const completedAt = new Date();
      return {
        success: true,
        duplicate: false,
        snapshotId: snapshot.snapshotId,
        usersScanned: snapshot.users.length,
        exportedAt: snapshot.exportedAt,
        ingestedAt: completedAt.toISOString(),
        message: `Accepted complete directory snapshot containing ${snapshot.users.length} users.`,
      };
    } catch (error) {
      const failure = safeFailure(error);
      if (runId) {
        await db.update(directorySyncRuns).set({
          status: "FAILED",
          completedAt: new Date(),
          errorCode: failure.code,
          errorMessage: failure.message,
        }).where(eq(directorySyncRuns.id, runId));
      }
      if (error instanceof DirectoryFeedError) throw error;
      if (error && typeof error === "object" && "code" in error && error.code === "23505") {
        throw new DirectoryFeedError("Snapshot ID has already been used.", "SNAPSHOT_REPLAY", 409);
      }
      throw new DirectoryFeedError(failure.message, failure.code, 503);
    } finally {
      this.isImporting = false;
    }
  }

  private async reconcileSnapshot(
    runId: string,
    snapshot: DirectoryFeedSnapshot,
    payloadSha256: string,
    deadline: number,
  ) {
    const groupConfiguration = getDirectoryGroupConfiguration();
    await db.transaction(async (tx) => {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) throw new DirectoryFeedError("Directory snapshot processing exceeded its time limit.", "PROCESSING_TIMEOUT", 503);
      await tx.execute(sql`SELECT set_config('statement_timeout', ${`${remainingMs}ms`}, true)`);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(44556677, 1)`);
      const [lastSuccess] = await tx.select({
        exportedAt: directorySyncRuns.exportedAt,
      }).from(directorySyncRuns)
        .where(and(
          eq(directorySyncRuns.status, "SUCCEEDED"),
          eq(directorySyncRuns.source, FEED_SOURCE),
          eq(directorySyncRuns.completeSnapshot, true),
        ))
        .orderBy(desc(directorySyncRuns.exportedAt))
        .limit(1);
      if (lastSuccess?.exportedAt && Date.parse(snapshot.exportedAt) <= lastSuccess.exportedAt.getTime()) {
        throw new DirectoryFeedError("Snapshot is not newer than the last accepted complete snapshot.", "STALE_SNAPSHOT", 409);
      }

      const snapshotTime = new Date(snapshot.exportedAt);
      const identityIds = new Map<string, string>();
      for (let offset = 0; offset < snapshot.users.length; offset += IMPORT_BATCH_SIZE) {
        if (Date.now() >= deadline) {
          throw new DirectoryFeedError("Directory snapshot processing exceeded its time limit.", "PROCESSING_TIMEOUT", 503);
        }
        const batch = snapshot.users.slice(offset, offset + IMPORT_BATCH_SIZE);
        const identities = await tx.insert(externalIdentities).values(batch.map((user) => ({
          tenantId: snapshot.tenantId,
          oid: user.objectId,
          email: user.mail,
          userPrincipalName: user.userPrincipalName,
          displayName: user.displayName,
          jobTitle: user.jobTitle,
          accountEnabled: user.accountEnabled,
          groupIds: user.groups.map((group) => group.objectId),
          department: user.department,
          academicBatch: user.academicBatch,
          academicClass: user.academicClass,
          source: FEED_SOURCE,
          isPresent: true,
          lastSeenAt: snapshotTime,
          lastSyncedAt: new Date(),
          status: user.accountEnabled === false ? "INACTIVE" : "UNRESOLVED",
        }))).onConflictDoUpdate({
          target: [externalIdentities.tenantId, externalIdentities.oid],
          set: {
            email: sql`excluded.college_email`,
            userPrincipalName: sql`excluded.user_principal_name`,
            displayName: sql`excluded.display_name`,
            jobTitle: sql`excluded.job_title`,
            accountEnabled: sql`excluded.account_enabled`,
            groupIds: sql`excluded.group_ids`,
            department: sql`excluded.directory_department`,
            academicBatch: sql`excluded.academic_batch`,
            academicClass: sql`excluded.academic_class`,
            source: FEED_SOURCE,
            isPresent: true,
            lastSeenAt: snapshotTime,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
            status: sql`CASE
              WHEN excluded.account_enabled = false THEN 'INACTIVE'
              WHEN excluded.account_enabled = true AND (
                ${externalIdentities.staffId} IS NOT NULL OR ${externalIdentities.studentId} IS NOT NULL
              ) THEN 'ACTIVE'
              ELSE 'UNRESOLVED'
            END`,
          },
        }).returning({ id: externalIdentities.id, oid: externalIdentities.oid });
        for (const identity of identities) identityIds.set(identity.oid, identity.id);

        await tx.insert(directorySyncRunMembers).values(batch.map((user) => ({
          runId,
          identityId: identityIds.get(user.objectId)!,
          displayName: user.displayName,
          email: user.mail,
          userPrincipalName: user.userPrincipalName,
          department: user.department,
          jobTitle: user.jobTitle,
          academicBatch: user.academicBatch,
          academicClass: user.academicClass,
          accountEnabled: user.accountEnabled,
          groupIds: user.groups.map((group) => group.objectId),
          syncedAt: new Date(),
        })));
      }

      if (Date.now() >= deadline) {
        throw new DirectoryFeedError("Directory snapshot processing exceeded its time limit.", "PROCESSING_TIMEOUT", 503);
      }
      const incomingObjectIds = JSON.stringify(snapshot.users.map((user) => user.objectId));
      await tx.update(externalIdentities).set({
        isPresent: false,
        status: sql`CASE WHEN ${externalIdentities.accountEnabled} = false THEN 'INACTIVE' ELSE 'ABSENT' END`,
        updatedAt: new Date(),
      }).where(and(
        eq(externalIdentities.tenantId, snapshot.tenantId),
        eq(externalIdentities.source, FEED_SOURCE),
        eq(externalIdentities.isPresent, true),
        sql`${externalIdentities.oid} NOT IN (
          SELECT jsonb_array_elements_text(${incomingObjectIds}::jsonb)
        )`,
      ));

      const mappingHash = createHash("sha256").update(JSON.stringify({
        membershipMode: groupConfiguration.membershipMode,
        studentGroups: groupConfiguration.itStudentGroupIds,
        staffGroups: groupConfiguration.itStaffGroupIds,
      })).digest("hex");
      const [previousMapping] = await tx.select({ newValues: auditLogs.newValues })
        .from(auditLogs)
        .where(eq(auditLogs.action, "DIRECTORY_GROUP_MAPPING_APPLIED"))
        .orderBy(desc(auditLogs.createdAt))
        .limit(1);
      const previousMappingHash = previousMapping?.newValues &&
        typeof previousMapping.newValues === "object" &&
        "configurationHash" in previousMapping.newValues
        ? previousMapping.newValues.configurationHash
        : null;
      if (previousMappingHash !== mappingHash) {
        await tx.insert(auditLogs).values({
          actorName: "Directory feed configuration",
          actorRole: "SYSTEM",
          action: "DIRECTORY_GROUP_MAPPING_APPLIED",
          entityType: "DIRECTORY_GROUP_MAPPING",
          description: "Server-side verified group mapping configuration applied to a directory snapshot.",
          oldValues: previousMappingHash ? { configurationHash: previousMappingHash } : null,
          newValues: {
            configurationHash: mappingHash,
            membershipMode: groupConfiguration.membershipMode,
            studentGroupIds: groupConfiguration.itStudentGroupIds,
            staffGroupIds: groupConfiguration.itStaffGroupIds,
          },
        });
      }
      await tx.insert(auditLogs).values({
        actorName: "College-authorized directory collector",
        actorRole: "SYSTEM",
        action: "INGEST_DIRECTORY_SNAPSHOT",
        entityType: "DIRECTORY_SNAPSHOT",
        entityId: snapshot.snapshotId,
        description: `Accepted complete directory snapshot with ${snapshot.users.length} source records.`,
        newValues: {
          tenantId: snapshot.tenantId,
          schemaVersion: snapshot.schemaVersion,
          exportedAt: snapshot.exportedAt,
          usersScanned: snapshot.users.length,
          payloadSha256,
        },
      });
      await tx.update(directorySyncRuns).set({
        status: "SUCCEEDED",
        completedAt: new Date(),
        ingestedAt: new Date(),
        pagesProcessed: 0,
        usersScanned: snapshot.users.length,
        errorCode: null,
        errorMessage: null,
      }).where(eq(directorySyncRuns.id, runId));
    });
  }
}

export const directoryFeedService = new DirectoryFeedService();
