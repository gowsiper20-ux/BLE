import { describe, expect, it } from "vitest";
import {
  DirectoryFeedError,
  signDirectoryFeedBody,
  validateDirectoryFeedSnapshot,
  verifyDirectoryFeedSignature,
  type DirectoryFeedConfiguration,
} from "../src/services/directory-feed";

const tenantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const groupId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const currentKey = Buffer.alloc(32, 7);
const previousKey = Buffer.alloc(32, 8);
const now = Date.parse("2026-10-19T14:00:00.000Z");

function configuration(overrides: Partial<DirectoryFeedConfiguration> = {}): DirectoryFeedConfiguration {
  return {
    tenantId,
    signingKeys: [currentKey],
    maxClockSkewSeconds: 300,
    maxSnapshotAgeMinutes: 1440,
    maxBodyBytes: 1024 * 1024,
    maxUsers: 100,
    maxProcessingTimeMs: 120_000,
    staleAfterMinutes: 1440,
    allowEmptySnapshot: false,
    ...overrides,
  };
}

function user(objectId = userId) {
  return {
    objectId,
    displayName: "Directory-provided name",
    userPrincipalName: "person@tenant.example",
    mail: null,
    accountEnabled: true,
    department: null,
    jobTitle: null,
    academicBatch: null,
    academicClass: null,
    groups: [{ objectId: groupId, displayName: "IT Students" }],
  };
}

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "1.0",
    tenantId,
    source: "Microsoft Entra ID",
    snapshotId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    exportedAt: "2026-10-19T13:59:00.000Z",
    completeSnapshot: true,
    membershipMode: "direct",
    users: [user()],
    ...overrides,
  };
}

describe("signed directory feed contract", () => {
  it("accepts a complete, tenant-matched snapshot and preserves explicit nulls", () => {
    const result = validateDirectoryFeedSnapshot(snapshot(), configuration(), now);
    expect(result.users[0].mail).toBeNull();
    expect(result.users[0].department).toBeNull();
    expect(result.users[0].objectId).toBe(userId);
    expect(result.completeSnapshot).toBe(true);
  });

  it("rejects invalid tenant, unsupported schema, partial snapshots, and duplicate user IDs", () => {
    expect(() => validateDirectoryFeedSnapshot(snapshot({ tenantId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" }), configuration(), now))
      .toThrowError(DirectoryFeedError);
    expect(() => validateDirectoryFeedSnapshot(snapshot({ schemaVersion: "2.0" }), configuration(), now))
      .toThrowError(/Unsupported/);
    expect(() => validateDirectoryFeedSnapshot(snapshot({ completeSnapshot: false }), configuration(), now))
      .toThrowError(/complete snapshots/);
    expect(() => validateDirectoryFeedSnapshot(snapshot({ users: [user(), user()] }), configuration(), now))
      .toThrowError(/duplicate user/);
  });

  it("rejects empty snapshots unless explicitly enabled", () => {
    const empty = snapshot({ users: [] });
    expect(() => validateDirectoryFeedSnapshot(empty, configuration(), now)).toThrowError(/Empty snapshots are disabled/);
    expect(validateDirectoryFeedSnapshot(empty, configuration({ allowEmptySnapshot: true }), now).users).toEqual([]);
  });

  it("rejects stale exports and malformed fields", () => {
    expect(() => validateDirectoryFeedSnapshot(
      snapshot({ exportedAt: "2026-10-17T00:00:00.000Z" }),
      configuration(),
      now,
    )).toThrowError(/older than the configured maximum age/);
    expect(() => validateDirectoryFeedSnapshot(
      snapshot({ users: [{ ...user(), accountEnabled: "yes" }] }),
      configuration(),
      now,
    )).toThrowError(/accountEnabled/);
  });

  it("verifies signatures against exact bytes, enforces timestamp skew, and supports key rotation", () => {
    const body = Buffer.from(JSON.stringify(snapshot()));
    const timestamp = String(Math.floor(now / 1000));
    const signature = signDirectoryFeedBody(body, timestamp, previousKey);
    const rotated = configuration({ signingKeys: [currentKey, previousKey] });

    expect(() => verifyDirectoryFeedSignature(body, timestamp, signature, rotated, now)).not.toThrow();
    expect(() => verifyDirectoryFeedSignature(Buffer.from(`${body.toString()} `), timestamp, signature, rotated, now))
      .toThrowError(/signature verification failed/);
    expect(() => verifyDirectoryFeedSignature(body, String(Number(timestamp) - 301), signature, rotated, now))
      .toThrowError(/clock-skew/);
    expect(() => verifyDirectoryFeedSignature(body, timestamp, "0".repeat(64), rotated, now))
      .toThrowError(/signature verification failed/);
  });
});
