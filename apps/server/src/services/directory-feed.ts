import { createHmac, timingSafeEqual } from "node:crypto";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FEED_SOURCE = "Microsoft Entra ID";

export interface DirectoryFeedGroup {
  objectId: string;
  displayName: string | null;
}

export interface DirectoryFeedUser {
  objectId: string;
  displayName: string | null;
  userPrincipalName: string | null;
  mail: string | null;
  accountEnabled: boolean | null;
  department: string | null;
  jobTitle: string | null;
  academicBatch: string | null;
  academicClass: string | null;
  groups: DirectoryFeedGroup[];
}

export interface DirectoryFeedSnapshot {
  schemaVersion: "1.0";
  tenantId: string;
  source: typeof FEED_SOURCE;
  snapshotId: string;
  exportedAt: string;
  completeSnapshot: true;
  membershipMode: "direct" | "transitive";
  users: DirectoryFeedUser[];
}

export interface DirectoryFeedConfiguration {
  tenantId: string | null;
  signingKeys: Buffer[];
  maxClockSkewSeconds: number;
  maxSnapshotAgeMinutes: number;
  maxBodyBytes: number;
  maxUsers: number;
  maxProcessingTimeMs: number;
  staleAfterMinutes: number;
  allowEmptySnapshot: boolean;
}

export class DirectoryFeedError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode: 400 | 401 | 403 | 409 | 413 | 503,
  ) {
    super(message);
    this.name = "DirectoryFeedError";
  }
}

function readPositiveInteger(name: string, fallback: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new Error(`CONFIG_ERROR: ${name} must be an integer between 1 and ${max}.`);
  }
  return value;
}

function parseSigningKey(name: string): Buffer | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(raw)) {
    throw new Error(`CONFIG_ERROR: ${name} must be a base64-encoded secret.`);
  }
  const key = Buffer.from(raw, "base64");
  if (key.length < 32 || key.toString("base64") !== raw) {
    throw new Error(`CONFIG_ERROR: ${name} must decode to at least 32 bytes.`);
  }
  return key;
}

export function getDirectoryFeedConfiguration(): DirectoryFeedConfiguration {
  const tenantId = process.env.DIRECTORY_FEED_TENANT_ID?.trim().toLowerCase() || null;
  if (tenantId && !UUID_PATTERN.test(tenantId)) {
    throw new Error("CONFIG_ERROR: DIRECTORY_FEED_TENANT_ID must be a tenant GUID.");
  }
  const allowEmptyRaw = process.env.DIRECTORY_FEED_ALLOW_EMPTY_SNAPSHOT?.trim().toLowerCase();
  if (allowEmptyRaw && allowEmptyRaw !== "true" && allowEmptyRaw !== "false") {
    throw new Error("CONFIG_ERROR: DIRECTORY_FEED_ALLOW_EMPTY_SNAPSHOT must be true or false.");
  }
  return {
    tenantId,
    signingKeys: [
      parseSigningKey("DIRECTORY_FEED_HMAC_SECRET"),
      parseSigningKey("DIRECTORY_FEED_HMAC_SECRET_PREVIOUS"),
    ].filter((key): key is Buffer => key !== null),
    maxClockSkewSeconds: readPositiveInteger("DIRECTORY_FEED_MAX_CLOCK_SKEW_SECONDS", 300, 3600),
    maxSnapshotAgeMinutes: readPositiveInteger("DIRECTORY_FEED_MAX_SNAPSHOT_AGE_MINUTES", 1440, 10080),
    maxBodyBytes: readPositiveInteger("DIRECTORY_FEED_MAX_BODY_BYTES", 26_214_400, 52_428_800),
    maxUsers: readPositiveInteger("DIRECTORY_FEED_MAX_USERS", 50_000, 250_000),
    maxProcessingTimeMs: readPositiveInteger("DIRECTORY_FEED_MAX_PROCESSING_TIME_MS", 120_000, 600_000),
    staleAfterMinutes: readPositiveInteger("DIRECTORY_FEED_STALE_AFTER_MINUTES", 1440, 10080),
    allowEmptySnapshot: allowEmptyRaw === "true",
  };
}

export function isDirectoryFeedConfigured(configuration = getDirectoryFeedConfiguration()): boolean {
  return Boolean(configuration.tenantId && configuration.signingKeys.length > 0);
}

export function signDirectoryFeedBody(body: Uint8Array, timestamp: string, key: Uint8Array): string {
  return createHmac("sha256", key).update(timestamp).update(".").update(body).digest("hex");
}

export function verifyDirectoryFeedSignature(
  body: Uint8Array,
  timestampHeader: string | undefined,
  signatureHeader: string | undefined,
  configuration: DirectoryFeedConfiguration,
  nowMilliseconds = Date.now(),
): void {
  if (!configuration.tenantId || configuration.signingKeys.length === 0) {
    throw new DirectoryFeedError("Directory feed receiver is not configured.", "FEED_NOT_CONFIGURED", 503);
  }
  if (!timestampHeader || !/^\d{10}$/.test(timestampHeader)) {
    throw new DirectoryFeedError("A valid feed timestamp header is required.", "INVALID_SIGNATURE", 401);
  }
  const timestampSeconds = Number(timestampHeader);
  if (Math.abs(Math.floor(nowMilliseconds / 1000) - timestampSeconds) > configuration.maxClockSkewSeconds) {
    throw new DirectoryFeedError("Feed timestamp is outside the permitted clock-skew window.", "STALE_SIGNATURE", 401);
  }
  if (!signatureHeader || !/^[a-f0-9]{64}$/i.test(signatureHeader)) {
    throw new DirectoryFeedError("A valid feed signature header is required.", "INVALID_SIGNATURE", 401);
  }
  const supplied = Buffer.from(signatureHeader, "hex");
  let valid = false;
  for (const key of configuration.signingKeys) {
    const expected = Buffer.from(signDirectoryFeedBody(body, timestampHeader, key), "hex");
    valid = timingSafeEqual(expected, supplied) || valid;
  }
  if (!valid) {
    throw new DirectoryFeedError("Feed signature verification failed.", "INVALID_SIGNATURE", 401);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: string[]): boolean {
  return Object.keys(value).length === expectedKeys.length && expectedKeys.every((key) => key in value);
}

function nullableString(
  value: unknown,
  field: string,
  maximumLength: number,
): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > maximumLength) {
    throw new DirectoryFeedError(`${field} must be a string of at most ${maximumLength} characters or null.`, "INVALID_FEED", 400);
  }
  return value;
}

function validDate(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new DirectoryFeedError(`${field} must be a UTC ISO-8601 timestamp.`, "INVALID_FEED", 400);
  }
  return value;
}

export function validateDirectoryFeedSnapshot(
  input: unknown,
  configuration: DirectoryFeedConfiguration,
  nowMilliseconds = Date.now(),
): DirectoryFeedSnapshot {
  const snapshotKeys = [
    "schemaVersion", "tenantId", "source", "snapshotId", "exportedAt",
    "completeSnapshot", "membershipMode", "users",
  ];
  if (!isRecord(input) || !hasExactKeys(input, snapshotKeys)) {
    throw new DirectoryFeedError("Snapshot fields do not match the supported feed contract.", "INVALID_FEED", 400);
  }
  if (input.schemaVersion !== "1.0") {
    throw new DirectoryFeedError("Unsupported directory feed schema version.", "UNSUPPORTED_SCHEMA", 400);
  }
  if (typeof input.tenantId !== "string" || !UUID_PATTERN.test(input.tenantId)) {
    throw new DirectoryFeedError("Snapshot tenantId must be a GUID.", "INVALID_FEED", 400);
  }
  if (!configuration.tenantId || input.tenantId.toLowerCase() !== configuration.tenantId) {
    throw new DirectoryFeedError("Snapshot tenant does not match the configured tenant.", "WRONG_TENANT", 403);
  }
  if (input.source !== FEED_SOURCE) {
    throw new DirectoryFeedError("Snapshot source must identify Microsoft Entra ID.", "INVALID_FEED", 400);
  }
  if (typeof input.snapshotId !== "string" || !UUID_PATTERN.test(input.snapshotId)) {
    throw new DirectoryFeedError("snapshotId must be a unique GUID.", "INVALID_FEED", 400);
  }
  const exportedAt = validDate(input.exportedAt, "exportedAt");
  const exportTime = Date.parse(exportedAt);
  if (exportTime > nowMilliseconds + configuration.maxClockSkewSeconds * 1000) {
    throw new DirectoryFeedError("Snapshot export timestamp is in the future.", "INVALID_FEED", 400);
  }
  if (nowMilliseconds - exportTime > configuration.maxSnapshotAgeMinutes * 60_000) {
    throw new DirectoryFeedError("Snapshot is older than the configured maximum age.", "STALE_SNAPSHOT", 400);
  }
  if (input.completeSnapshot !== true) {
    throw new DirectoryFeedError("Only complete snapshots are accepted; partial and incremental feeds cannot replace a snapshot.", "INCOMPLETE_SNAPSHOT", 400);
  }
  if (input.membershipMode !== "direct" && input.membershipMode !== "transitive") {
    throw new DirectoryFeedError("membershipMode must be direct or transitive.", "INVALID_FEED", 400);
  }
  if (!Array.isArray(input.users) || input.users.length > configuration.maxUsers) {
    throw new DirectoryFeedError(`users must be an array of at most ${configuration.maxUsers} entries.`, "INVALID_FEED", 400);
  }
  if (input.users.length === 0 && !configuration.allowEmptySnapshot) {
    throw new DirectoryFeedError("Empty snapshots are disabled; explicitly approve them before importing.", "EMPTY_SNAPSHOT", 400);
  }

  const userKeys = [
    "objectId", "displayName", "userPrincipalName", "mail", "accountEnabled",
    "department", "jobTitle", "academicBatch", "academicClass", "groups",
  ];
  const groupKeys = ["objectId", "displayName"];
  const seenUsers = new Set<string>();
  const users: DirectoryFeedUser[] = input.users.map((candidate, index) => {
    if (!isRecord(candidate) || !hasExactKeys(candidate, userKeys)) {
      throw new DirectoryFeedError(`users[${index}] does not match the supported user contract.`, "INVALID_FEED", 400);
    }
    if (typeof candidate.objectId !== "string" || !UUID_PATTERN.test(candidate.objectId)) {
      throw new DirectoryFeedError(`users[${index}].objectId must be an Entra object GUID.`, "INVALID_FEED", 400);
    }
    const objectId = candidate.objectId.toLowerCase();
    if (seenUsers.has(objectId)) {
      throw new DirectoryFeedError("Snapshot contains duplicate user object IDs.", "DUPLICATE_USER", 400);
    }
    seenUsers.add(objectId);
    if (candidate.accountEnabled !== null && typeof candidate.accountEnabled !== "boolean") {
      throw new DirectoryFeedError(`users[${index}].accountEnabled must be boolean or null.`, "INVALID_FEED", 400);
    }
    if (!Array.isArray(candidate.groups) || candidate.groups.length > 1000) {
      throw new DirectoryFeedError(`users[${index}].groups must be an array of at most 1000 entries.`, "INVALID_FEED", 400);
    }
    const seenGroups = new Set<string>();
    const groups = candidate.groups.map((group, groupIndex): DirectoryFeedGroup => {
      if (!isRecord(group) || !hasExactKeys(group, groupKeys) || typeof group.objectId !== "string" || !UUID_PATTERN.test(group.objectId)) {
        throw new DirectoryFeedError(`users[${index}].groups[${groupIndex}] is invalid.`, "INVALID_FEED", 400);
      }
      const groupId = group.objectId.toLowerCase();
      if (seenGroups.has(groupId)) {
        throw new DirectoryFeedError(`users[${index}] contains duplicate group object IDs.`, "INVALID_FEED", 400);
      }
      seenGroups.add(groupId);
      return {
        objectId: groupId,
        displayName: nullableString(group.displayName, `users[${index}].groups[${groupIndex}].displayName`, 255),
      };
    });
    return {
      objectId,
      displayName: nullableString(candidate.displayName, `users[${index}].displayName`, 255),
      userPrincipalName: nullableString(candidate.userPrincipalName, `users[${index}].userPrincipalName`, 255),
      mail: nullableString(candidate.mail, `users[${index}].mail`, 255),
      accountEnabled: candidate.accountEnabled,
      department: nullableString(candidate.department, `users[${index}].department`, 255),
      jobTitle: nullableString(candidate.jobTitle, `users[${index}].jobTitle`, 255),
      academicBatch: nullableString(candidate.academicBatch, `users[${index}].academicBatch`, 255),
      academicClass: nullableString(candidate.academicClass, `users[${index}].academicClass`, 255),
      groups,
    };
  });

  return {
    schemaVersion: "1.0",
    tenantId: input.tenantId.toLowerCase(),
    source: FEED_SOURCE,
    snapshotId: input.snapshotId.toLowerCase(),
    exportedAt,
    completeSnapshot: true,
    membershipMode: input.membershipMode,
    users,
  };
}
