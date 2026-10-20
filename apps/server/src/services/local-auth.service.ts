import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { facultyAuthAccounts, staffCredentials } from '../db/schema/auth';
import { roles, staff, staffRoles } from '../db/schema/staff';
import type { AuthPrincipal } from '@smart-attendance/shared';

const SESSION_LIFETIME_SECONDS = 60 * 60 * 8;
const BCRYPT_ROUNDS = 12;
const LOCAL_SESSION_KIND = 'hod-session';
const FACULTY_SESSION_KIND = 'faculty-session';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters.');
  }
  return new TextEncoder().encode(secret);
}

export class LocalAuthService {
  private readonly dummyHash = bcrypt.hash(randomBytes(32).toString('hex'), BCRYPT_ROUNDS);

  private createSessionToken(staffId: string, sessionVersion: number): Promise<string> {
    return new SignJWT({ kind: LOCAL_SESSION_KIND, sessionVersion })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(staffId)
      .setIssuedAt()
      .setExpirationTime(`${SESSION_LIFETIME_SECONDS}s`)
      .sign(getJwtSecret());
  }

  async login(email: string, password: string): Promise<{ principal: AuthPrincipal; token: string } | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const entries = await db
      .select({
        staffId: staff.id,
        staffCode: staff.staffCode,
        name: staff.name,
        collegeEmail: staff.collegeEmail,
        status: staff.status,
        passwordHash: staffCredentials.passwordHash,
        sessionVersion: staffCredentials.sessionVersion,
        role: roles.name,
      })
      .from(staffCredentials)
      .innerJoin(staff, eq(staffCredentials.staffId, staff.id))
      .innerJoin(staffRoles, eq(staffRoles.staffId, staff.id))
      .innerJoin(roles, eq(staffRoles.roleId, roles.id))
      .where(and(
        eq(staff.collegeEmail, normalizedEmail),
        eq(staff.status, 'ACTIVE'),
        inArray(roles.name, ['ADMIN', 'HOD', 'STAFF']),
      ));

    const entry = entries[0];
    if (entry) {
      if (!await bcrypt.compare(password, entry.passwordHash)) return null;
      const principal: AuthPrincipal = {
        id: entry.staffId,
        name: entry.name,
        collegeEmail: entry.collegeEmail,
        staffCode: entry.staffCode,
        roles: ['ADMIN', 'HOD', 'STAFF'].filter((role) => entries.some((item) => item.role === role)) as AuthPrincipal['roles'],
        userType: 'STAFF',
      };
      const token = await this.createSessionToken(entry.staffId, entry.sessionVersion);
      return { principal, token };
    }

    const facultyAccount = (await db.select()
      .from(facultyAuthAccounts)
      .where(and(
        eq(facultyAuthAccounts.email, normalizedEmail),
        eq(facultyAuthAccounts.status, 'ACTIVE'),
        eq(facultyAuthAccounts.role, 'FACULTY'),
      )))[0];
    const passwordMatches = await bcrypt.compare(password, facultyAccount?.passwordHash || await this.dummyHash);
    if (!facultyAccount || !passwordMatches) return null;

    const principal: AuthPrincipal = {
      id: facultyAccount.id,
      name: facultyAccount.name,
      collegeEmail: facultyAccount.email,
      roles: ['FACULTY'],
      userType: 'STAFF',
    };
    const token = await new SignJWT({ kind: FACULTY_SESSION_KIND, sessionVersion: facultyAccount.sessionVersion })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(facultyAccount.id)
      .setIssuedAt()
      .setExpirationTime(`${SESSION_LIFETIME_SECONDS}s`)
      .sign(getJwtSecret());
    return { principal, token };
  }

  async registerFacultyAccount(
    name: string,
    email: string,
    password: string,
  ): Promise<{ principal: AuthPrincipal; token: string }> {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const normalizedEmail = email.trim().toLowerCase();

    const account = await db.transaction(async (tx) => {
      const existingStaff = await tx.select({ id: staff.id })
        .from(staff)
        .where(sql`lower(${staff.collegeEmail}) = ${normalizedEmail}`)
        .limit(1);
      const existingFacultyAccount = await tx.select({ id: facultyAuthAccounts.id })
        .from(facultyAuthAccounts)
        .where(sql`lower(${facultyAuthAccounts.email}) = ${normalizedEmail}`)
        .limit(1);
      if (existingStaff.length || existingFacultyAccount.length) {
        throw new DuplicateFacultyAccountError();
      }

      const [created] = await tx.insert(facultyAuthAccounts).values({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: 'FACULTY',
        status: 'ACTIVE',
      }).returning({
        id: facultyAuthAccounts.id,
        name: facultyAuthAccounts.name,
        email: facultyAuthAccounts.email,
        sessionVersion: facultyAuthAccounts.sessionVersion,
      });
      return created;
    });

    const principal: AuthPrincipal = {
      id: account.id,
      name: account.name,
      collegeEmail: account.email,
      roles: ['FACULTY'],
      userType: 'STAFF',
    };
    const token = await new SignJWT({ kind: FACULTY_SESSION_KIND, sessionVersion: account.sessionVersion })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(account.id)
      .setIssuedAt()
      .setExpirationTime(`${SESSION_LIFETIME_SECONDS}s`)
      .sign(getJwtSecret());

    return { principal, token };
  }

  async verifySession(token: string): Promise<AuthPrincipal> {
    const { payload } = await jwtVerify(token, getJwtSecret(), { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string' || typeof payload.sessionVersion !== 'number') {
      throw new Error('Invalid session.');
    }

    if (payload.kind === FACULTY_SESSION_KIND) {
      const account = (await db.select()
        .from(facultyAuthAccounts)
        .where(and(
          eq(facultyAuthAccounts.id, payload.sub),
          eq(facultyAuthAccounts.status, 'ACTIVE'),
          eq(facultyAuthAccounts.role, 'FACULTY'),
        )))[0];
      if (!account || account.sessionVersion !== payload.sessionVersion) {
        throw new Error('Invalid session.');
      }
      return {
        id: account.id,
        name: account.name,
        collegeEmail: account.email,
        roles: ['FACULTY'],
        userType: 'STAFF',
      };
    }

    if (payload.kind !== LOCAL_SESSION_KIND) throw new Error('Invalid session.');

    const entries = await db
      .select({
        staffId: staff.id,
        staffCode: staff.staffCode,
        name: staff.name,
        collegeEmail: staff.collegeEmail,
        status: staff.status,
        sessionVersion: staffCredentials.sessionVersion,
        role: roles.name,
      })
      .from(staffCredentials)
      .innerJoin(staff, eq(staffCredentials.staffId, staff.id))
      .innerJoin(staffRoles, eq(staffRoles.staffId, staff.id))
      .innerJoin(roles, eq(staffRoles.roleId, roles.id))
      .where(and(
        eq(staff.id, payload.sub),
        eq(staff.status, 'ACTIVE'),
        inArray(roles.name, ['ADMIN', 'HOD', 'STAFF']),
      ));
    const account = entries[0];
    if (!account || account.sessionVersion !== payload.sessionVersion) {
      throw new Error('Invalid session.');
    }

    return {
      id: account.staffId,
      name: account.name,
      collegeEmail: account.collegeEmail,
      staffCode: account.staffCode,
      roles: [...new Set(entries.map((entry) => entry.role).filter((role): role is 'ADMIN' | 'HOD' | 'STAFF' => role === 'ADMIN' || role === 'HOD' || role === 'STAFF'))],
      userType: 'STAFF',
    };
  }

  async invalidateSessions(staffId: string): Promise<void> {
    await db
      .update(staffCredentials)
      .set({ sessionVersion: sql`${staffCredentials.sessionVersion} + 1`, updatedAt: new Date() })
      .where(eq(staffCredentials.staffId, staffId));
  }

  async invalidateFacultySessions(accountId: string): Promise<void> {
    await db.update(facultyAuthAccounts)
      .set({ sessionVersion: sql`${facultyAuthAccounts.sessionVersion} + 1`, updatedAt: new Date() })
      .where(eq(facultyAuthAccounts.id, accountId));
  }

  static isValidEmail(email: string): boolean {
    return email.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  }

  static hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }
}

export class DuplicateFacultyAccountError extends Error {
  readonly code = '23505';

  constructor() {
    super('A user account with this email already exists.');
  }
}

export const localAuthService = new LocalAuthService();
