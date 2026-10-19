import { and, asc, desc, eq, ilike, isNotNull, or, sql } from "drizzle-orm";
import { db } from "../db";
import { directorySyncRunMembers, directorySyncRuns, externalIdentities } from "../db/schema/auth";
import { AuditService } from "./audit.service";
import {
  classifyDirectoryGroups,
  getDirectoryAcademicAttributeNames,
  getDirectoryGroupConfiguration,
  readDirectoryAcademicAttribute,
} from "./directory-classification";
import type { AuditActor } from "./staff.service";

export interface SyncResult {
  success: boolean;
  mode: "LIVE_GRAPH";
  staffSynced: number;
  studentsSynced: number;
  totalSynced: number;
  unresolvedCount: number;
  disabledCount: number;
  pagesProcessed: number;
  totalScanned: number;
  classifiedStudentCount: number;
  classifiedStaffCount: number;
  domain: string;
  message: string;
  startTime: string;
  endTime: string;
}

interface GraphUser {
  id?: string;
  displayName?: string | null;
  mail?: string | null;
  userPrincipalName?: string | null;
  accountEnabled?: boolean | null;
  department?: string | null;
  [attribute: string]: unknown;
}

interface GraphUsersPage {
  value?: GraphUser[];
  "@odata.nextLink"?: string;
}

export class MsGraphService {
  private readonly audit = new AuditService();
  private isSyncing = false;

  private groupOverlap(
    groupIds: string[],
    column: typeof externalIdentities.groupIds | typeof directorySyncRunMembers.groupIds = externalIdentities.groupIds,
  ) {
    return groupIds.length
      ? sql`${column} && ARRAY[${sql.join(groupIds.map((id) => sql`${id}`), sql`, `)}]::text[]`
      : sql`false`;
  }

  isConfigured(): boolean {
    return Boolean(
      process.env.MICROSOFT_TENANT_ID?.trim() &&
      process.env.MICROSOFT_CLIENT_ID?.trim() &&
      process.env.MICROSOFT_CLIENT_SECRET?.trim(),
    );
  }

  async getDirectoryStatus() {
    const configured = this.isConfigured();
    const groupConfiguration = getDirectoryGroupConfiguration();
    readDirectoryAcademicAttribute({}, "MICROSOFT_BATCH_ATTRIBUTE");
    readDirectoryAcademicAttribute({}, "MICROSOFT_CLASS_ATTRIBUTE");
    const [storedCount] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(externalIdentities);
    const [lastSuccessfulRun] = await db.select().from(directorySyncRuns)
      .where(eq(directorySyncRuns.status, "SUCCEEDED"))
      .orderBy(desc(directorySyncRuns.completedAt))
      .limit(1);
    const [latestRun] = await db.select({
      status: directorySyncRuns.status,
      startedAt: directorySyncRuns.startedAt,
      completedAt: directorySyncRuns.completedAt,
      pagesProcessed: directorySyncRuns.pagesProcessed,
      usersScanned: directorySyncRuns.usersScanned,
      failurePage: directorySyncRuns.failurePage,
      errorCode: directorySyncRuns.errorCode,
      errorMessage: directorySyncRuns.errorMessage,
    }).from(directorySyncRuns)
      .orderBy(desc(directorySyncRuns.startedAt))
      .limit(1);
    const currentSnapshot = lastSuccessfulRun
      ? eq(directorySyncRunMembers.runId, lastSuccessfulRun.id)
      : sql`false`;
    const [{ count: syncedCount }] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(directorySyncRunMembers)
      .where(currentSnapshot);
    const [disabledCount] = await db.select({
      count: sql<number>`cast(count(*) as integer)`,
    }).from(directorySyncRunMembers).where(and(currentSnapshot, eq(directorySyncRunMembers.accountEnabled, false)));
    const studentGroups = groupConfiguration.itStudentGroupIds;
    const staffGroups = groupConfiguration.itStaffGroupIds;
    const studentOverlap = this.groupOverlap(studentGroups, directorySyncRunMembers.groupIds);
    const staffOverlap = this.groupOverlap(staffGroups, directorySyncRunMembers.groupIds);
    const bothConfigured = studentGroups.length > 0 && staffGroups.length > 0 && groupConfiguration.membershipMode;
    const [{ count: studentCount }] = studentGroups.length && groupConfiguration.membershipMode
      ? await db.select({ count: sql<number>`cast(count(*) as integer)` }).from(directorySyncRunMembers).where(and(
        currentSnapshot,
        studentOverlap,
        bothConfigured ? sql`NOT (${staffOverlap})` : undefined,
      ))
      : [{ count: 0 }];
    const [{ count: staffCount }] = staffGroups.length && groupConfiguration.membershipMode
      ? await db.select({ count: sql<number>`cast(count(*) as integer)` }).from(directorySyncRunMembers).where(and(
        currentSnapshot,
        staffOverlap,
        bothConfigured ? sql`NOT (${studentOverlap})` : undefined,
      ))
      : [{ count: 0 }];
    const [{ count: conflictCount }] = bothConfigured
      ? await db.select({ count: sql<number>`cast(count(*) as integer)` }).from(directorySyncRunMembers).where(and(
        currentSnapshot,
        studentOverlap,
        staffOverlap,
      ))
      : [{ count: 0 }];
    const configuredGroupOverlap = groupConfiguration.membershipMode
      ? this.groupOverlap([...studentGroups, ...staffGroups], directorySyncRunMembers.groupIds)
      : sql`false`;
    const failedRuns = await db.select({
      status: directorySyncRuns.status,
      startedAt: directorySyncRuns.startedAt,
      completedAt: directorySyncRuns.completedAt,
      failurePage: directorySyncRuns.failurePage,
      errorCode: directorySyncRuns.errorCode,
      errorMessage: directorySyncRuns.errorMessage,
    }).from(directorySyncRuns)
      .where(eq(directorySyncRuns.status, "FAILED"))
      .orderBy(desc(directorySyncRuns.startedAt))
      .limit(5);
    const [{ count: knownBatchCount }] = await db.select({
      count: sql<number>`cast(count(distinct ${directorySyncRunMembers.academicBatch}) as integer)`,
    }).from(directorySyncRunMembers).where(and(
      currentSnapshot,
      studentGroups.length && groupConfiguration.membershipMode ? studentOverlap : sql`false`,
      bothConfigured ? sql`NOT (${staffOverlap})` : undefined,
      isNotNull(directorySyncRunMembers.academicBatch),
    ));
    const [{ count: knownClassCount }] = await db.select({
      count: sql<number>`cast(count(distinct ${directorySyncRunMembers.academicClass}) as integer)`,
    }).from(directorySyncRunMembers).where(and(
      currentSnapshot,
      studentGroups.length && groupConfiguration.membershipMode ? studentOverlap : sql`false`,
      bothConfigured ? sql`NOT (${staffOverlap})` : undefined,
      isNotNull(directorySyncRunMembers.academicClass),
    ));
    const [{ count: unresolvedCount }] = await db.select({
      count: sql<number>`cast(count(*) as integer)`,
    }).from(directorySyncRunMembers).where(and(
      currentSnapshot,
      sql`NOT (${configuredGroupOverlap})`,
    ));

    return {
      configured,
      source: configured ? "Microsoft Graph" : "Not configured",
      collegeDomain: (process.env.COLLEGE_EMAIL_DOMAIN || "sonatech.ac.in").split(",")[0].trim(),
      storedIdentityRows: storedCount?.count || 0,
      totalSynchronizedUsers: syncedCount || 0,
      verifiedItStudentIdentities: groupConfiguration.membershipMode ? studentCount : 0,
      verifiedItFacultyStaffIdentities: groupConfiguration.membershipMode ? staffCount : 0,
      conflictingGroupClassifications: Number(conflictCount || 0),
      verifiedGroupClassifications: groupConfiguration.membershipMode && (studentGroups.length > 0 || staffGroups.length > 0),
      unclassifiedUsers: groupConfiguration.membershipMode ? unresolvedCount : syncedCount || 0,
      disabledAccounts: disabledCount?.count || 0,
      verifiedBatchValues: Number(knownBatchCount || 0),
      verifiedClassValues: Number(knownClassCount || 0),
      academicAttributesConfigured: getDirectoryAcademicAttributeNames().length > 0,
      batchAttributeConfigured: Boolean(process.env.MICROSOFT_BATCH_ATTRIBUTE?.trim()),
      classAttributeConfigured: Boolean(process.env.MICROSOFT_CLASS_ATTRIBUTE?.trim()),
      membershipMode: groupConfiguration.membershipMode,
      studentGroupIdsConfigured: studentGroups.length > 0,
      staffGroupIdsConfigured: staffGroups.length > 0,
      lastSuccessfulFullSync: lastSuccessfulRun?.completedAt || null,
      lastSyncCounts: lastSuccessfulRun ? {
        pagesProcessed: lastSuccessfulRun.pagesProcessed,
        usersScanned: lastSuccessfulRun.usersScanned,
      } : null,
      latestAttempt: latestRun || null,
      failures: failedRuns,
      classification: groupConfiguration.membershipMode
        ? "Classifications are based only on configured, direct Entra group memberships."
        : "Unclassified; verified group IDs and approved membership semantics are required.",
    };
  }

  async getItStudents(filters: {
    search?: string;
    academicBatch?: string;
    academicClass?: string;
    accountStatus?: "enabled" | "disabled" | "unknown";
    page?: number;
    limit?: number;
    sortBy?: "displayName" | "email" | "academicBatch" | "academicClass" | "accountEnabled";
    sortOrder?: "asc" | "desc";
  }) {
    return this.getDirectoryMembers("student", filters);
  }

  async getItStaff(filters: {
    search?: string;
    academicBatch?: string;
    academicClass?: string;
    accountStatus?: "enabled" | "disabled" | "unknown";
    page?: number;
    limit?: number;
    sortBy?: "displayName" | "email" | "academicBatch" | "academicClass" | "accountEnabled";
    sortOrder?: "asc" | "desc";
  }) {
    return this.getDirectoryMembers("staff", filters);
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
      sortBy?: "displayName" | "email" | "academicBatch" | "academicClass" | "accountEnabled";
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

    const configuration = getDirectoryGroupConfiguration();
    const groupIds = classification === "student"
      ? configuration.itStudentGroupIds
      : configuration.itStaffGroupIds;
    const opposingGroupIds = classification === "student"
      ? configuration.itStaffGroupIds
      : configuration.itStudentGroupIds;
    const [lastSuccessfulRun] = await db.select({ id: directorySyncRuns.id })
      .from(directorySyncRuns)
      .where(eq(directorySyncRuns.status, "SUCCEEDED"))
      .orderBy(desc(directorySyncRuns.completedAt))
      .limit(1);
    const currentSnapshot = lastSuccessfulRun
      ? eq(directorySyncRunMembers.runId, lastSuccessfulRun.id)
      : sql`false`;
    const baseConditions = [
      currentSnapshot,
      groupIds.length > 0 && configuration.membershipMode
        ? this.groupOverlap(groupIds, directorySyncRunMembers.groupIds)
        : sql`false`,
      groupIds.length > 0 && opposingGroupIds.length > 0 && configuration.membershipMode
        ? sql`NOT (${this.groupOverlap(opposingGroupIds, directorySyncRunMembers.groupIds)})`
        : undefined,
    ];
    const filtersConditions = [...baseConditions];
    if (search) {
      const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
      filtersConditions.push(or(
        ilike(directorySyncRunMembers.displayName, pattern),
        ilike(directorySyncRunMembers.email, pattern),
      )!);
    }
    if (filters.academicBatch) filtersConditions.push(eq(directorySyncRunMembers.academicBatch, filters.academicBatch));
    if (filters.academicClass) filtersConditions.push(eq(directorySyncRunMembers.academicClass, filters.academicClass));
    if (filters.accountStatus === "enabled") filtersConditions.push(eq(directorySyncRunMembers.accountEnabled, true));
    if (filters.accountStatus === "disabled") filtersConditions.push(eq(directorySyncRunMembers.accountEnabled, false));
    if (filters.accountStatus === "unknown") filtersConditions.push(sql`${directorySyncRunMembers.accountEnabled} IS NULL`);

    const sortColumns = {
      displayName: directorySyncRunMembers.displayName,
      email: directorySyncRunMembers.email,
      academicBatch: directorySyncRunMembers.academicBatch,
      academicClass: directorySyncRunMembers.academicClass,
      accountEnabled: directorySyncRunMembers.accountEnabled,
    };
    const sortColumn = sortColumns[filters.sortBy || "displayName"];
    const sortDirection = filters.sortOrder === "desc" ? desc : asc;
    const whereClause = and(...filtersConditions);
    const [data, countResult] = await Promise.all([
      db.select({
        id: directorySyncRunMembers.identityId,
        displayName: directorySyncRunMembers.displayName,
        email: directorySyncRunMembers.email,
        department: directorySyncRunMembers.department,
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
    ]);
    const [filterValues] = await db.select({
      batches: sql<string[]>`array_remove(array_agg(distinct ${directorySyncRunMembers.academicBatch}), NULL)`,
      classes: sql<string[]>`array_remove(array_agg(distinct ${directorySyncRunMembers.academicClass}), NULL)`,
    }).from(directorySyncRunMembers).where(and(...baseConditions));
    const total = Number(countResult[0]?.count || 0);

    return {
      identities: data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      filters: {
        batches: filterValues?.batches || [],
        classes: filterValues?.classes || [],
      },
      classificationConfigured: Boolean(configuration.membershipMode && groupIds.length),
      academicAttributesConfigured: getDirectoryAcademicAttributeNames().length > 0,
      batchAttributeConfigured: Boolean(process.env.MICROSOFT_BATCH_ATTRIBUTE?.trim()),
      classAttributeConfigured: Boolean(process.env.MICROSOFT_CLASS_ATTRIBUTE?.trim()),
    };
  }

  async getUnresolvedIdentities(limit = 50, page = 1) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(page) || page < 1) {
      throw new Error("INVALID_PAGINATION: limit must be 1-100 and page must be positive.");
    }
    const offset = (page - 1) * limit;
    const rows = await db
      .select()
      .from(externalIdentities)
      .where(eq(externalIdentities.status, "UNRESOLVED"))
      .orderBy(desc(externalIdentities.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ count }] = await db
      .select({ count: sql`cast(count(*) as integer)` })
      .from(externalIdentities)
      .where(eq(externalIdentities.status, "UNRESOLVED"));

    return {
      data: rows,
      pagination: {
        page,
        limit,
        total: count as number,
        totalPages: Math.ceil((count as number) / limit),
      },
    };
  }

  async syncDirectory(actor?: AuditActor): Promise<SyncResult> {
    if (!this.isConfigured()) {
      throw new Error("GRAPH_NOT_CONFIGURED: Set MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, and MICROSOFT_CLIENT_SECRET.");
    }
    if (this.isSyncing) throw new Error("SYNC_IN_PROGRESS: A directory synchronization is already running.");

    this.isSyncing = true;
    const startedAt = new Date();
    let runId: string | undefined;
    try {
      const [run] = await db.insert(directorySyncRuns).values({
        status: "RUNNING",
        mode: "FULL",
        startedAt,
      }).returning({ id: directorySyncRuns.id });
      runId = run.id;
      const result = await this.syncFromGraph(actor, run.id, startedAt);
      return result;
    } catch (error) {
      const failure = error instanceof Error ? error.message : "Directory synchronization failed.";
      const errorCode = failure.match(/^([A-Z][A-Z0-9_]+):/)?.[1] || "DIRECTORY_SYNC_FAILED";
      if (runId) {
        await db.update(directorySyncRuns).set({
          status: "FAILED",
          completedAt: new Date(),
          failurePage: Number(failure.match(/page\s+(\d+)/i)?.[1]) || null,
          errorCode,
          errorMessage: failure.slice(0, 1000),
        }).where(eq(directorySyncRuns.id, runId));
      }
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const response = await fetch(url, init);
        if (response.ok || (response.status < 500 && response.status !== 429)) return response;
        lastError = new Error(`Microsoft Graph request failed with HTTP ${response.status}.`);
        const retryHeader = response.headers.get("Retry-After");
        const retryAfter = retryHeader ? Number(retryHeader) : 2 ** attempt;
        const waitMs = Math.min(Number.isFinite(retryAfter) ? Math.max(retryAfter, 0) * 1000 : 2 ** attempt * 1000, 30_000);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      } catch (error) {
        lastError = error;
        if (attempt === 4) break;
        await new Promise((resolve) => setTimeout(resolve, Math.min(2 ** attempt * 1000, 30_000)));
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Microsoft Graph request failed after bounded retries.");
  }

  private async getConfiguredGroupMemberships(
    groupIds: string[],
    headers: Record<string, string>,
  ): Promise<Map<string, string[]>> {
    const memberships = new Map<string, string[]>();
    for (const groupId of groupIds) {
      let nextUrl: string | null =
        `https://graph.microsoft.com/v1.0/groups/${encodeURIComponent(groupId)}/members/microsoft.graph.user?$select=id&$top=999`;
      const visitedPages = new Set<string>();

      while (nextUrl) {
        if (visitedPages.has(nextUrl) || new URL(nextUrl).origin !== "https://graph.microsoft.com") {
          throw new Error("GRAPH_GROUP_PAGINATION_INVALID: Group-membership continuation URL was invalid.");
        }
        visitedPages.add(nextUrl);
        const response = await this.fetchWithRetry(nextUrl, { headers });
        if (!response.ok) {
          throw new Error(`GRAPH_GROUPS_FAILED: Microsoft Graph returned HTTP ${response.status} for configured group membership.`);
        }
        const page = await response.json() as GraphUsersPage;
        if (!Array.isArray(page.value)) {
          throw new Error("GRAPH_GROUPS_INVALID: Group-membership response did not contain a user list.");
        }
        for (const member of page.value) {
          const memberId = member.id?.trim().toLowerCase();
          if (memberId) {
            const memberGroups = memberships.get(memberId) || [];
            memberGroups.push(groupId);
            memberships.set(memberId, memberGroups);
          }
        }
        nextUrl = page["@odata.nextLink"] || null;
      }
    }

    return memberships;
  }

  private async syncFromGraph(actor: AuditActor | undefined, runId: string, startedAt: Date): Promise<SyncResult> {
    const tenantId = process.env.MICROSOFT_TENANT_ID!;
    const clientId = process.env.MICROSOFT_CLIENT_ID!;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!;
    const groupConfiguration = getDirectoryGroupConfiguration();
    const academicAttributeNames = getDirectoryAcademicAttributeNames();
    for (const settingName of ["MICROSOFT_BATCH_ATTRIBUTE", "MICROSOFT_CLASS_ATTRIBUTE"]) {
      readDirectoryAcademicAttribute({}, settingName);
    }
    const tokenResponse = await this.fetchWithRetry(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "client_credentials",
          scope: "https://graph.microsoft.com/.default",
        }),
      },
    );
    if (!tokenResponse.ok) throw new Error(`GRAPH_TOKEN_FAILED: Microsoft identity platform returned HTTP ${tokenResponse.status}.`);
    const tokenPayload = await tokenResponse.json() as { access_token?: string };
    if (!tokenPayload.access_token) throw new Error("GRAPH_TOKEN_FAILED: The token response did not contain an access token.");

    const headers = { Authorization: `Bearer ${tokenPayload.access_token}` };
    const configuredGroupIds = [
      ...new Set([...groupConfiguration.itStudentGroupIds, ...groupConfiguration.itStaffGroupIds]),
    ];
    const memberships = groupConfiguration.membershipMode === "direct"
      ? await this.getConfiguredGroupMemberships(configuredGroupIds, headers)
      : new Map<string, string[]>();
    const selectedAttributes = [
      "id", "displayName", "mail", "userPrincipalName", "accountEnabled", "department",
      ...academicAttributeNames,
    ];
    let nextUrl: string | null =
      `https://graph.microsoft.com/v1.0/users?${new URLSearchParams({
        $select: [...new Set(selectedAttributes)].join(","),
        $top: "999",
      })}`;
    let pagesProcessed = 0;
    let totalScanned = 0;
    let disabledCount = 0;
    let classifiedStudentCount = 0;
    let classifiedStaffCount = 0;
    let unresolvedCount = 0;
    const visitedPages = new Set<string>();
    while (nextUrl) {
      if (visitedPages.has(nextUrl)) {
        throw new Error(`GRAPH_PAGINATION_INVALID: Microsoft Graph repeated page ${pagesProcessed + 1}.`);
      }
      const pageOrigin = new URL(nextUrl).origin;
      if (pageOrigin !== "https://graph.microsoft.com") {
        throw new Error("GRAPH_PAGINATION_INVALID: Continuation URL was not on the Microsoft Graph host.");
      }
      visitedPages.add(nextUrl);
      const pageResponse = await this.fetchWithRetry(nextUrl, { headers });
      if (!pageResponse.ok) {
        throw new Error(`GRAPH_PAGE_FAILED: Microsoft Graph returned HTTP ${pageResponse.status} for page ${pagesProcessed + 1}.`);
      }
      const pageData = await pageResponse.json() as GraphUsersPage;
      if (!Array.isArray(pageData.value)) {
        throw new Error(`GRAPH_PAGE_INVALID: Microsoft Graph page ${pagesProcessed + 1} did not contain a user list.`);
      }
      pagesProcessed++;
      totalScanned += pageData.value.length;

      for (const user of pageData.value) {
        const oid = user.id?.trim();
        if (!oid) throw new Error(`GRAPH_USER_INVALID: User on page ${pagesProcessed} lacks a stable object ID.`);
        const email = user.mail?.trim().toLowerCase() || user.userPrincipalName?.trim().toLowerCase() || null;
        const groupIds = memberships.get(oid.toLowerCase()) || [];
        const classification = classifyDirectoryGroups(groupIds, groupConfiguration);
        const accountEnabled = typeof user.accountEnabled === "boolean" ? user.accountEnabled : null;
        const status = accountEnabled === false ? "INACTIVE" : "UNRESOLVED";
        if (accountEnabled === false) disabledCount++;
        if (classification === "IT_STUDENT") classifiedStudentCount++;
        else if (classification === "IT_FACULTY_STAFF") classifiedStaffCount++;
        else if (classification === "UNCLASSIFIED") unresolvedCount++;

        const [identity] = await db.insert(externalIdentities).values({
          provider: "MICROSOFT",
          tenantId,
          oid,
          email,
          status,
          displayName: user.displayName?.trim() || null,
          accountEnabled,
          groupIds,
          department: user.department?.trim() || null,
          academicBatch: readDirectoryAcademicAttribute(user, "MICROSOFT_BATCH_ATTRIBUTE"),
          academicClass: readDirectoryAcademicAttribute(user, "MICROSOFT_CLASS_ATTRIBUTE"),
          lastSyncedAt: new Date(),
        }).onConflictDoUpdate({
          target: [externalIdentities.tenantId, externalIdentities.oid],
          set: {
            email,
            displayName: user.displayName?.trim() || null,
            accountEnabled,
            groupIds,
            department: user.department?.trim() || null,
            academicBatch: readDirectoryAcademicAttribute(user, "MICROSOFT_BATCH_ATTRIBUTE"),
            academicClass: readDirectoryAcademicAttribute(user, "MICROSOFT_CLASS_ATTRIBUTE"),
            lastSyncedAt: new Date(),
            status: accountEnabled === false
              ? "INACTIVE"
              : sql`CASE
                  WHEN ${externalIdentities.staffId} IS NOT NULL OR ${externalIdentities.studentId} IS NOT NULL
                  THEN 'ACTIVE'
                  ELSE 'UNRESOLVED'
                END`,
            updatedAt: new Date(),
          },
        }).returning({ id: externalIdentities.id });
        await db.insert(directorySyncRunMembers).values({
          runId,
          identityId: identity.id,
          displayName: user.displayName?.trim() || null,
          email,
          department: user.department?.trim() || null,
          academicBatch: readDirectoryAcademicAttribute(user, "MICROSOFT_BATCH_ATTRIBUTE"),
          academicClass: readDirectoryAcademicAttribute(user, "MICROSOFT_CLASS_ATTRIBUTE"),
          accountEnabled,
          groupIds,
          syncedAt: new Date(),
        }).onConflictDoNothing();
      }

      await db.update(directorySyncRuns).set({
        pagesProcessed,
        usersScanned: totalScanned,
      }).where(eq(directorySyncRuns.id, runId));
      nextUrl = pageData["@odata.nextLink"] || null;
    }

    const endDate = new Date();
    const endTime = endDate.toISOString();
    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: "SYNC_MICROSOFT_DIRECTORY",
      entityType: "MICROSOFT_GRAPH",
      description: `Retrieved ${totalScanned} users across ${pagesProcessed} completed Microsoft Graph pages.`,
      newValues: {
        classifiedStudentCount,
        classifiedStaffCount,
        unresolvedCount,
        disabledCount,
        pagesProcessed,
        totalScanned,
        startTime: startedAt.toISOString(),
        endTime,
      },
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
    });
    await db.update(directorySyncRuns).set({
      status: "SUCCEEDED",
      completedAt: endDate,
      pagesProcessed,
      usersScanned: totalScanned,
    }).where(eq(directorySyncRuns.id, runId));

    return {
      success: true,
      mode: "LIVE_GRAPH",
      staffSynced: classifiedStaffCount,
      studentsSynced: classifiedStudentCount,
      totalSynced: totalScanned,
      unresolvedCount,
      disabledCount,
      pagesProcessed,
      totalScanned,
      classifiedStudentCount,
      classifiedStaffCount,
      domain: "All users accessible to the configured tenant application",
      startTime: startedAt.toISOString(),
      endTime,
      message: `Retrieved ${totalScanned} accessible tenant users across ${pagesProcessed} completed pages; classified ${classifiedStudentCount} verified IT students and ${classifiedStaffCount} verified IT faculty/staff.`,
    };
  }
}

export const msGraphService = new MsGraphService();
