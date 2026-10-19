import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { db } from '../db';
import { externalIdentities } from '../db/schema/auth';
import { staff, staffRoles, roles } from '../db/schema/staff';
import { students } from '../db/schema/students';
import { classes } from '../db/schema/academic';
import { eq, and } from 'drizzle-orm';
import type { UserRole, AuthPrincipal } from '@smart-attendance/shared';

export interface VerifiedClaims {
  oid: string;
  tid: string;
  email: string;
  name: string;
  sub: string;
  roles?: string[];
}

export class MsAuthService {
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
  private currentJwksTenantId: string | null = null;

  private getJwks(tenantId: string) {
    if (!this.jwks || this.currentJwksTenantId !== tenantId) {
      this.currentJwksTenantId = tenantId;
      this.jwks = createRemoteJWKSet(
        new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`)
      );
    }
    return this.jwks;
  }

  /**
   * Returns the configured JWT secret, enforcing fail-closed in production.
   */
  getJwtSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.trim() === '') {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: JWT_SECRET environment variable is missing in production.');
      }
      // For local development only, require explicit non-default secret or log warning
      console.warn('⚠️ WARNING: Using local development secret. Set JWT_SECRET in production.');
      return new TextEncoder().encode('development_only_secret_must_be_changed_in_prod_32chars!');
    }
    return new TextEncoder().encode(secret);
  }

  /**
   * Validate a Microsoft Entra ID access or ID token.
   * Enforces signature, issuer, tenant, audience, expiration, and email domain.
   */
  async validateMicrosoftToken(token: string): Promise<VerifiedClaims> {
    if (!token || typeof token !== 'string') {
      throw new Error('MISSING_TOKEN: Token was not provided.');
    }

    const expectedTenantId = process.env.MICROSOFT_TENANT_ID;
    const expectedAudience = process.env.MICROSOFT_API_AUDIENCE || process.env.MICROSOFT_CLIENT_ID;
    const rawDomains = process.env.COLLEGE_EMAIL_DOMAIN || 'sonatech.ac.in';
    const allowedDomains = rawDomains
      .toLowerCase()
      .split(',')
      .map((d) => d.trim().replace(/^@/, ''));

    // Check for test mock token in test mode
    if (
      (process.env.NODE_ENV === 'test' || process.env.ENABLE_TEST_TOKENS === 'true') &&
      token.startsWith('test-ms-token:')
    ) {
      return this.parseTestToken(token, expectedTenantId, rawDomains);
    }

    if (!expectedTenantId) {
      throw new Error('CONFIG_ERROR: MICROSOFT_TENANT_ID is not configured.');
    }

    const jwks = this.getJwks(expectedTenantId);

    // Verify token using Microsoft JWKS
    let payload: any;
    try {
      const result = await jwtVerify(token, jwks, {
        issuer: [
          `https://login.microsoftonline.com/${expectedTenantId}/v2.0`,
          `https://sts.windows.net/${expectedTenantId}/`,
        ],
        audience: expectedAudience ? [expectedAudience] : undefined,
      });
      payload = result.payload;
    } catch (err: any) {
      if (err.code === 'ERR_JWT_EXPIRED') {
        throw new Error('TOKEN_EXPIRED: The Microsoft token has expired.');
      }
      if (err.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
        throw new Error(`CLAIM_VALIDATION_FAILED: ${err.message}`);
      }
      throw new Error(`TOKEN_INVALID: ${err.message || 'Signature validation failed.'}`);
    }

    // 1. Validate tenant ID strictly
    const tokenTenantId = payload.tid;
    if (!tokenTenantId || tokenTenantId !== expectedTenantId) {
      throw new Error(`WRONG_TENANT: Token issued by tenant '${tokenTenantId}', expected '${expectedTenantId}'.`);
    }

    // 2. Extract stable OID
    const oid = payload.oid || payload.sub;
    if (!oid) {
      throw new Error('MISSING_OID: Token does not contain an object identifier (oid).');
    }

    // 3. Extract and validate college email
    const email = (payload.preferred_username || payload.email || payload.upn || '').toLowerCase().trim();
    if (!email) {
      throw new Error('MISSING_EMAIL: Token does not contain an email or preferred_username claim.');
    }

    const matchesDomain = allowedDomains.some((d) => email.endsWith(`@${d}`));
    if (!matchesDomain) {
      throw new Error(`INVALID_DOMAIN: Account '${email}' does not belong to '@${allowedDomains[0]}'.`);
    }

    const name = payload.name || payload.preferred_username || email;

    return {
      oid,
      tid: tokenTenantId,
      email,
      name,
      sub: payload.sub,
      roles: Array.isArray(payload.roles) ? payload.roles : [],
    };
  }

  /**
   * Helper for parsing test tokens in unit/integration tests without external network dependency.
   */
  private parseTestToken(token: string, expectedTenantId?: string, collegeDomain: string = 'sonatech.ac.in'): VerifiedClaims {
    // Format: test-ms-token:{"oid":"...","tid":"...","email":"...","name":"...","expired":false}
    const jsonStr = token.replace('test-ms-token:', '');
    let data: any;
    try {
      data = JSON.parse(jsonStr);
    } catch {
      throw new Error('TOKEN_INVALID: Malformed test token JSON.');
    }

    if (data.expired) {
      throw new Error('TOKEN_EXPIRED: The Microsoft token has expired.');
    }

    if (data.invalidSignature) {
      throw new Error('TOKEN_INVALID: Signature validation failed.');
    }

    if (expectedTenantId && data.tid && data.tid !== expectedTenantId) {
      throw new Error(`WRONG_TENANT: Token issued by tenant '${data.tid}', expected '${expectedTenantId}'.`);
    }

    const allowedDomains = collegeDomain.toLowerCase().split(',').map((d) => d.trim().replace(/^@/, ''));
    if (data.email) {
      const emailLower = data.email.toLowerCase();
      const matches = allowedDomains.some((d) => emailLower.endsWith(`@${d}`));
      if (!matches) {
        throw new Error(`INVALID_DOMAIN: Account '${data.email}' does not belong to '@${allowedDomains[0]}'.`);
      }
    }

    return {
      oid: data.oid || 'test-oid',
      tid: data.tid || expectedTenantId || 'test-tenant',
      email: (data.email || `user@${allowedDomains[0]}`).toLowerCase(),
      name: data.name || 'Test User',
      sub: data.sub || data.oid || 'test-sub',
      roles: data.roles || [],
    };
  }

  /**
   * Resolve an authenticated Microsoft external identity to an application AuthPrincipal.
   * If the user is enrolled in PostgreSQL, links their external identity if not already linked.
   * If not enrolled, fails closed (UNPROVISIONED).
   */
  async resolveUserIdentity(claims: VerifiedClaims): Promise<AuthPrincipal> {
    const { oid, tid, email, name } = claims;

    // 1. Look up existing external identity mapping
    const existingIdentity = await db
      .select()
      .from(externalIdentities)
      .where(and(eq(externalIdentities.tenantId, tid), eq(externalIdentities.oid, oid)))
      .then((rows) => rows[0]);

    if (existingIdentity) {
      if (existingIdentity.status !== 'ACTIVE') {
        throw new Error('ACCOUNT_INACTIVE: This Microsoft identity mapping has been disabled.');
      }

      if (existingIdentity.staffId) {
        return this.resolveStaffPrincipal(existingIdentity.staffId, oid, tid);
      }

      if (existingIdentity.studentId) {
        return this.resolveStudentPrincipal(existingIdentity.studentId, oid, tid);
      }
    }

    // 2. If not mapped yet, search staff by collegeEmail or existing microsoftUserId
    const staffMatch = await db
      .select()
      .from(staff)
      .where(eq(staff.collegeEmail, email))
      .then((rows) => rows[0]);

    if (staffMatch) {
      if (staffMatch.status !== 'ACTIVE') {
        throw new Error('ACCOUNT_INACTIVE: Your staff account is currently inactive. Contact your administrator.');
      }

      // Link external identity
      await db.insert(externalIdentities).values({
        staffId: staffMatch.id,
        provider: 'MICROSOFT',
        tenantId: tid,
        oid,
        email,
        status: 'ACTIVE',
      });

      // Update staff record with microsoftUserId if empty
      if (!staffMatch.microsoftUserId) {
        await db.update(staff).set({ microsoftUserId: oid, updatedAt: new Date() }).where(eq(staff.id, staffMatch.id));
      }

      return this.resolveStaffPrincipal(staffMatch.id, oid, tid);
    }

    // 3. Search students by collegeEmail or existing microsoftUserId
    const studentMatch = await db
      .select()
      .from(students)
      .where(eq(students.collegeEmail, email))
      .then((rows) => rows[0]);

    if (studentMatch) {
      if (studentMatch.status !== 'ACTIVE') {
        throw new Error('ACCOUNT_INACTIVE: Your student account is currently inactive or suspended.');
      }

      // Link external identity
      await db.insert(externalIdentities).values({
        studentId: studentMatch.id,
        provider: 'MICROSOFT',
        tenantId: tid,
        oid,
        email,
        status: 'ACTIVE',
      });

      if (!studentMatch.microsoftUserId) {
        await db.update(students).set({ microsoftUserId: oid, updatedAt: new Date() }).where(eq(students.id, studentMatch.id));
      }

      return this.resolveStudentPrincipal(studentMatch.id, oid, tid);
    }

    // 4. Auto-provisioning for college accounts (if enabled in college demo/project mode)
    if (process.env.AUTO_PROVISION_COLLEGE_ACCOUNTS === 'true') {
      const emailPrefix = email.split('@')[0];
      const isStudent = /\d{4,}/.test(emailPrefix) || emailPrefix.includes('.it') || emailPrefix.includes('student');

      if (isStudent) {
        const defaultClass = await db.select().from(classes).where(eq(classes.status, 'ACTIVE')).limit(1).then((r) => r[0]);
        if (defaultClass) {
          const regNumber = emailPrefix.match(/\d{10,}/)?.[0] || `6178${Date.now().toString().slice(-8)}`;
          const [newStudent] = await db.insert(students).values({
            registerNumber: regNumber,
            name: name || 'Student',
            collegeEmail: email,
            classId: defaultClass.id,
            microsoftUserId: oid,
            status: 'ACTIVE',
          }).returning();

          await db.insert(externalIdentities).values({
            studentId: newStudent.id,
            provider: 'MICROSOFT',
            tenantId: tid,
            oid,
            email,
            status: 'ACTIVE',
          });

          return this.resolveStudentPrincipal(newStudent.id, oid, tid);
        }
      }

      // Auto-provision as Staff member
      const staffCode = `IT-FAC-${Date.now().toString().slice(-4)}`;
      const [newStaff] = await db.insert(staff).values({
        staffCode,
        name: name || 'Faculty Member',
        collegeEmail: email,
        microsoftUserId: oid,
        status: 'ACTIVE',
      }).returning();

      const staffRole = await db.select().from(roles).where(eq(roles.name, 'STAFF')).then((r) => r[0]);
      if (staffRole) {
        await db.insert(staffRoles).values({
          staffId: newStaff.id,
          roleId: staffRole.id,
        });
      }

      await db.insert(externalIdentities).values({
        staffId: newStaff.id,
        provider: 'MICROSOFT',
        tenantId: tid,
        oid,
        email,
        status: 'ACTIVE',
      });

      return this.resolveStaffPrincipal(newStaff.id, oid, tid);
    }

    // 5. Not provisioned in database: Fail Closed
    throw new Error(
      `UNPROVISIONED_ACCOUNT: Your account '${email}' is not registered in the SONA Smart Attendance system. Please contact your department administrator.`
    );
  }

  private async resolveStaffPrincipal(staffId: string, oid: string, tid: string): Promise<AuthPrincipal> {
    const staffUser = await db.select().from(staff).where(eq(staff.id, staffId)).then((rows) => rows[0]);
    if (!staffUser || staffUser.status !== 'ACTIVE') {
      throw new Error('ACCOUNT_INACTIVE: Staff account is inactive or not found.');
    }

    // Load active roles for staff
    const staffRoleRows = await db
      .select({ roleName: roles.name })
      .from(staffRoles)
      .innerJoin(roles, eq(staffRoles.roleId, roles.id))
      .where(eq(staffRoles.staffId, staffId));

    const roleNames = staffRoleRows.map((r) => r.roleName as UserRole);
    // Ensure at least STAFF role if none assigned
    if (roleNames.length === 0) {
      roleNames.push('STAFF');
    }

    return {
      id: staffUser.id,
      name: staffUser.name,
      collegeEmail: staffUser.collegeEmail,
      roles: roleNames,
      userType: 'STAFF',
      staffCode: staffUser.staffCode,
      microsoftUserId: oid,
      tenantId: tid,
    };
  }

  private async resolveStudentPrincipal(studentId: string, oid: string, tid: string): Promise<AuthPrincipal> {
    const studentUser = await db.select().from(students).where(eq(students.id, studentId)).then((rows) => rows[0]);
    if (!studentUser || studentUser.status !== 'ACTIVE') {
      throw new Error('ACCOUNT_INACTIVE: Student account is inactive or not found.');
    }

    return {
      id: studentUser.id,
      name: studentUser.name,
      collegeEmail: studentUser.collegeEmail,
      roles: ['STUDENT'],
      userType: 'STUDENT',
      registerNumber: studentUser.registerNumber,
      microsoftUserId: oid,
      tenantId: tid,
    };
  }

  /**
   * Mints an internal session JWT token representing the validated principal.
   */
  async createSessionToken(principal: AuthPrincipal, expiresInSeconds = 86400): Promise<string> {
    const secret = this.getJwtSecret();
    return new SignJWT({
      id: principal.id,
      email: principal.collegeEmail,
      roles: principal.roles,
      userType: principal.userType,
      name: principal.name,
      staffCode: principal.staffCode,
      registerNumber: principal.registerNumber,
      oid: principal.microsoftUserId,
      tid: principal.tenantId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
      .sign(secret);
  }

  /**
   * Verifies an internal session JWT token.
   */
  async verifySessionToken(token: string): Promise<AuthPrincipal> {
    const secret = this.getJwtSecret();
    const { payload } = await jwtVerify(token, secret);

    // Verify against DB to ensure account wasn't deactivated
    if (payload.userType === 'STAFF') {
      return this.resolveStaffPrincipal(payload.id as string, payload.oid as string, payload.tid as string);
    } else {
      return this.resolveStudentPrincipal(payload.id as string, payload.oid as string, payload.tid as string);
    }
  }
}

export const msAuthService = new MsAuthService();
