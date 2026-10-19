import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { msAuthService } from '../src/services/ms-auth.service';
import { db } from '../src/db';
import { staff, roles, staffRoles } from '../src/db/schema/staff';
import { externalIdentities } from '../src/db/schema/auth';
import { eq } from 'drizzle-orm';
import app from '../src/index';

const TEST_TENANT = '00000000-0000-0000-0000-000000000000';
const TEST_COLLEGE_DOMAIN = 'sonatech.ac.in';

describe('Microsoft Entra ID Authentication & RBAC Test Suite', () => {
  let adminStaffId: string;
  let testStaffId: string;
  let inactiveStaffId: string;
  let adminRoleRecord: any;
  let staffRoleRecord: any;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTO_PROVISION_COLLEGE_ACCOUNTS = 'false';
    process.env.MICROSOFT_TENANT_ID = TEST_TENANT;
    process.env.COLLEGE_EMAIL_DOMAIN = TEST_COLLEGE_DOMAIN;
    process.env.JWT_SECRET = 'test_secret_for_vitest_runner_min_32_characters_long!';

    // Ensure roles exist in DB
    let rAdmin = await db.select().from(roles).where(eq(roles.name, 'ADMIN')).then((rows) => rows[0]);
    if (!rAdmin) {
      rAdmin = await db.insert(roles).values({ name: 'ADMIN', description: 'System Administrator' }).returning().then((rows) => rows[0]);
    }
    adminRoleRecord = rAdmin;

    let rStaff = await db.select().from(roles).where(eq(roles.name, 'STAFF')).then((rows) => rows[0]);
    if (!rStaff) {
      rStaff = await db.insert(roles).values({ name: 'STAFF', description: 'Teaching Staff' }).returning().then((rows) => rows[0]);
    }
    staffRoleRecord = rStaff;

    // Create test active staff
    const testStaffEmail = `test.staff.${Date.now()}@${TEST_COLLEGE_DOMAIN}`;
    const sTest = await db.insert(staff).values({
      staffCode: `TST-${Date.now().toString().slice(-4)}`,
      name: 'Test Staff Member',
      collegeEmail: testStaffEmail,
      status: 'ACTIVE',
    }).returning().then((rows) => rows[0]);
    testStaffId = sTest.id;

    await db.insert(staffRoles).values({
      staffId: testStaffId,
      roleId: staffRoleRecord.id,
    });

    // Create test active admin
    const testAdminEmail = `test.admin.${Date.now()}@${TEST_COLLEGE_DOMAIN}`;
    const sAdmin = await db.insert(staff).values({
      staffCode: `ADM-${Date.now().toString().slice(-4)}`,
      name: 'Test Admin User',
      collegeEmail: testAdminEmail,
      status: 'ACTIVE',
    }).returning().then((rows) => rows[0]);
    adminStaffId = sAdmin.id;

    await db.insert(staffRoles).values({
      staffId: adminStaffId,
      roleId: adminRoleRecord.id,
    });

    // Create inactive staff
    const testInactiveEmail = `test.inactive.${Date.now()}@${TEST_COLLEGE_DOMAIN}`;
    const sInactive = await db.insert(staff).values({
      staffCode: `INA-${Date.now().toString().slice(-4)}`,
      name: 'Inactive Staff User',
      collegeEmail: testInactiveEmail,
      status: 'INACTIVE',
    }).returning().then((rows) => rows[0]);
    inactiveStaffId = sInactive.id;
  });

  afterAll(async () => {
    // Clean up test identities and records
    if (testStaffId) {
      await db.delete(externalIdentities).where(eq(externalIdentities.staffId, testStaffId));
      await db.delete(staffRoles).where(eq(staffRoles.staffId, testStaffId));
      await db.delete(staff).where(eq(staff.id, testStaffId));
    }
    if (adminStaffId) {
      await db.delete(externalIdentities).where(eq(externalIdentities.staffId, adminStaffId));
      await db.delete(staffRoles).where(eq(staffRoles.staffId, adminStaffId));
      await db.delete(staff).where(eq(staff.id, adminStaffId));
    }
    if (inactiveStaffId) {
      await db.delete(staff).where(eq(staff.id, inactiveStaffId));
    }
  });

  describe('1. Microsoft Entra ID Token Validation', () => {
    it('should successfully validate an authentic college domain token (@sevenotech.ac.in)', async () => {
      const mockToken = `test-ms-token:${JSON.stringify({
        oid: 'oid-valid-123',
        tid: TEST_TENANT,
        email: `faculty@${TEST_COLLEGE_DOMAIN}`,
        name: 'Dr. Valid Faculty',
      })}`;

      const claims = await msAuthService.validateMicrosoftToken(mockToken);
      expect(claims.oid).toBe('oid-valid-123');
      expect(claims.tid).toBe(TEST_TENANT);
      expect(claims.email).toBe(`faculty@${TEST_COLLEGE_DOMAIN}`);
      expect(claims.name).toBe('Dr. Valid Faculty');
    });

    it('should reject a non-college email domain (e.g. @gmail.com)', async () => {
      const mockToken = `test-ms-token:${JSON.stringify({
        oid: 'oid-intruder-456',
        tid: TEST_TENANT,
        email: 'intruder@gmail.com',
        name: 'Non College User',
      })}`;

      await expect(msAuthService.validateMicrosoftToken(mockToken)).rejects.toThrow(/INVALID_DOMAIN/);
    });

    it('should reject a token from an untrusted / incorrect tenant', async () => {
      const mockToken = `test-ms-token:${JSON.stringify({
        oid: 'oid-foreign-789',
        tid: 'foreign-tenant-id-9999',
        email: `user@${TEST_COLLEGE_DOMAIN}`,
        name: 'Foreign Tenant User',
      })}`;

      await expect(msAuthService.validateMicrosoftToken(mockToken)).rejects.toThrow(/WRONG_TENANT/);
    });

    it('should reject an expired token', async () => {
      const mockToken = `test-ms-token:${JSON.stringify({
        oid: 'oid-expired-111',
        tid: TEST_TENANT,
        email: `expired@${TEST_COLLEGE_DOMAIN}`,
        expired: true,
      })}`;

      await expect(msAuthService.validateMicrosoftToken(mockToken)).rejects.toThrow(/TOKEN_EXPIRED/);
    });

    it('should reject an invalid signature / tampered token', async () => {
      const mockToken = `test-ms-token:${JSON.stringify({
        oid: 'oid-tampered-222',
        tid: TEST_TENANT,
        email: `tampered@${TEST_COLLEGE_DOMAIN}`,
        invalidSignature: true,
      })}`;

      await expect(msAuthService.validateMicrosoftToken(mockToken)).rejects.toThrow(/TOKEN_INVALID/);
    });

    it('should reject when token is empty or missing', async () => {
      await expect(msAuthService.validateMicrosoftToken('')).rejects.toThrow(/MISSING_TOKEN/);
    });

    it('should not accept test tokens outside the test environment even when explicitly enabled', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      process.env.ENABLE_TEST_TOKENS = 'true';
      process.env.MICROSOFT_API_AUDIENCE = 'api://test-api';
      process.env.MICROSOFT_API_SCOPE = 'access_as_user';
      try {
        await expect(msAuthService.validateMicrosoftToken('test-ms-token:{}')).rejects.toThrow(/TOKEN_INVALID/);
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        delete process.env.ENABLE_TEST_TOKENS;
      }
    });
  });

  describe('2. User Provisioning & Identity Resolution', () => {
    it('should reject an email match without an explicit tenant/object mapping', async () => {
      const enrolledStaff = await db.select().from(staff).where(eq(staff.id, testStaffId)).then((rows) => rows[0]);
      const claims = {
        oid: 'oid-unprovisioned-999',
        tid: TEST_TENANT,
        sub: 'oid-unprovisioned-999',
        email: enrolledStaff.collegeEmail,
        name: 'Unregistered User',
        roles: [],
      };

      await expect(msAuthService.resolveUserIdentity(claims)).rejects.toThrow(/UNPROVISIONED_ACCOUNT/);
    });

    it('should reject an enrolled user whose status is INACTIVE', async () => {
      const inactiveStaff = await db.select().from(staff).where(eq(staff.id, inactiveStaffId)).then((rows) => rows[0]);
      await db.insert(externalIdentities).values({
        staffId: inactiveStaffId,
        provider: 'MICROSOFT',
        tenantId: TEST_TENANT,
        oid: 'oid-inactive-000',
        email: inactiveStaff.collegeEmail,
        status: 'ACTIVE',
      });
      const claims = {
        oid: 'oid-inactive-000',
        tid: TEST_TENANT,
        sub: 'oid-inactive-000',
        email: inactiveStaff.collegeEmail,
        name: inactiveStaff.name,
        roles: [],
      };

      await expect(msAuthService.resolveUserIdentity(claims)).rejects.toThrow(/ACCOUNT_INACTIVE/);
    });

    it('should resolve an active staff member only through an explicit tenant/object mapping', async () => {
      const enrolledStaff = await db.select().from(staff).where(eq(staff.id, testStaffId)).then((rows) => rows[0]);
      const oid = `oid-staff-${Date.now()}`;
      await db.insert(externalIdentities).values({
        staffId: testStaffId,
        provider: 'MICROSOFT',
        tenantId: TEST_TENANT,
        oid,
        email: enrolledStaff.collegeEmail,
        status: 'ACTIVE',
      });
      const claims = {
        oid,
        tid: TEST_TENANT,
        sub: oid,
        email: enrolledStaff.collegeEmail,
        name: enrolledStaff.name,
        roles: [],
      };

      const principal = await msAuthService.resolveUserIdentity(claims);
      expect(principal.id).toBe(enrolledStaff.id);
      expect(principal.collegeEmail).toBe(enrolledStaff.collegeEmail);
      expect(principal.roles).toContain('STAFF');
      expect(principal.userType).toBe('STAFF');

      // Verify the explicit mapping remains keyed by the tenant and object ID.
      const identityRecord = await db
        .select()
        .from(externalIdentities)
        .where(eq(externalIdentities.oid, oid))
        .then((rows) => rows[0]);

      expect(identityRecord).toBeDefined();
      expect(identityRecord.staffId).toBe(enrolledStaff.id);
      expect(identityRecord.tenantId).toBe(TEST_TENANT);
    });
  });

  describe('3. Session Token & Endpoint Authorization (RBAC)', () => {
    it('should reject unauthenticated request to /api/settings with 401', async () => {
      const res = await app.request('/api/settings');
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject STAFF role from modifying settings via PUT /api/settings with 403', async () => {
      const staffPrincipal = {
        id: testStaffId,
        name: 'Test Staff',
        collegeEmail: `staff@${TEST_COLLEGE_DOMAIN}`,
        roles: ['STAFF'] as any,
        userType: 'STAFF' as any,
      };
      const staffToken = await msAuthService.createSessionToken(staffPrincipal);

      const res = await app.request('/api/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${staffToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates: [{ key: 'test_key', value: 'test_val' }] }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('should permit ADMIN role accessing /api/settings with 200', async () => {
      const adminPrincipal = {
        id: adminStaffId,
        name: 'Test Admin',
        collegeEmail: `admin@${TEST_COLLEGE_DOMAIN}`,
        roles: ['ADMIN'] as any,
        userType: 'STAFF' as any,
      };
      const adminToken = await msAuthService.createSessionToken(adminPrincipal);

      const res = await app.request('/api/settings', {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('should reject student directory mutations even for an administrator', async () => {
      const adminPrincipal = {
        id: adminStaffId,
        name: 'Test Admin',
        collegeEmail: `admin@${TEST_COLLEGE_DOMAIN}`,
        roles: ['ADMIN'] as any,
        userType: 'STAFF' as any,
      };
      const adminToken = await msAuthService.createSessionToken(adminPrincipal);
      const response = await app.request('/api/students', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ registerNumber: '12345', name: 'Not Created' }),
      });

      expect(response.status).toBe(405);
      expect((await response.json()).error.code).toBe('DIRECTORY_READ_ONLY');
    });

    it('should reject staff directory mutations even for an administrator', async () => {
      const adminPrincipal = {
        id: adminStaffId,
        name: 'Test Admin',
        collegeEmail: `admin@${TEST_COLLEGE_DOMAIN}`,
        roles: ['ADMIN'] as any,
        userType: 'STAFF' as any,
      };
      const adminToken = await msAuthService.createSessionToken(adminPrincipal);
      const response = await app.request('/api/staff', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ staffCode: 'NOT-CREATED', name: 'Not Created' }),
      });

      expect(response.status).toBe(405);
      expect((await response.json()).error.code).toBe('DIRECTORY_READ_ONLY');
    });

    it('should reject role assignment because the staff directory is read-only', async () => {
      const staffPrincipal = {
        id: testStaffId,
        name: 'Test Staff',
        collegeEmail: `staff@${TEST_COLLEGE_DOMAIN}`,
        roles: ['STAFF'] as any,
        userType: 'STAFF' as any,
      };
      const staffToken = await msAuthService.createSessionToken(staffPrincipal);

      const res = await app.request(`/api/staff/${testStaffId}/roles`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${staffToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'ADMIN' }),
      });

      expect(res.status).toBe(405);
      expect((await res.json()).error.code).toBe('DIRECTORY_READ_ONLY');
    });

    it('should complete sign-in only for an explicitly mapped identity', async () => {
      const enrolledStaff = await db.select().from(staff).where(eq(staff.id, testStaffId)).then((rows) => rows[0]);
      const oid = `oid-flow-${Date.now()}`;
      await db.insert(externalIdentities).values({
        staffId: testStaffId,
        provider: 'MICROSOFT',
        tenantId: TEST_TENANT,
        oid,
        email: enrolledStaff.collegeEmail,
        status: 'ACTIVE',
      });
      const mockToken = `test-ms-token:${JSON.stringify({
        oid,
        tid: TEST_TENANT,
        email: enrolledStaff.collegeEmail,
        name: enrolledStaff.name,
      })}`;

      const res = await app.request('/api/auth/microsoft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: mockToken }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(res.headers.get('set-cookie')).toContain('admin_token');
      expect(body.user.collegeEmail).toBe(enrolledStaff.collegeEmail);
      expect(body.user.roles).toContain('STAFF');
    });

    it('should reject POST /api/auth/microsoft for a non-college test identity', async () => {
      const mockToken = `test-ms-token:${JSON.stringify({
        oid: 'oid-intruder-http',
        tid: TEST_TENANT,
        email: 'attacker@evil.com',
        name: 'Attacker',
      })}`;

      const res = await app.request('/api/auth/microsoft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: mockToken }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_DOMAIN');
      expect(body.error.message).toContain('INVALID_DOMAIN');
    });
  });
});
