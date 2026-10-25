import { describe, expect, it, vi } from 'vitest';

// Mock DB module before it loads and runs the test database safety guard
vi.mock('../src/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
          then: vi.fn((cb) => Promise.resolve(cb([]))),
        })),
      })),
    })),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { Hono } from 'hono';
import { requireRole, requireHodOrAdmin } from '../src/middlewares/auth.middleware';
import { SessionTokenService } from '../src/services/session-token.service';
import { AttendanceAuthService } from '../src/services/attendance-auth.service';
import type { AuthPrincipal } from '@smart-attendance/shared';

describe('Security and Role Authorization Unit Tests', () => {
  describe('RBAC Middleware - requireRole', () => {
    it('returns 401 UNAUTHORIZED when no authenticated user is present', async () => {
      const app = new Hono();
      app.get('/admin-only', requireRole('ADMIN'), (c) => c.json({ ok: true }));

      const res = await app.request('/admin-only');
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 FORBIDDEN when user lacks the required role', async () => {
      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('user', {
          id: 'user-staff-1',
          name: 'Regular Staff',
          collegeEmail: 'staff@sonatech.ac.in',
          roles: ['STAFF'],
          userType: 'STAFF',
        } as AuthPrincipal);
        await next();
      });
      app.get('/hod-only', requireHodOrAdmin, (c) => c.json({ ok: true }));

      const res = await app.request('/hod-only');
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe('FORBIDDEN');
      expect(data.error.message).toContain('Access denied');
    });

    it('allows access when user has one of the approved roles', async () => {
      const rolesToTest: Array<'ADMIN' | 'HOD' | 'DEPUTY_HOD'> = ['ADMIN', 'HOD', 'DEPUTY_HOD'];

      for (const role of rolesToTest) {
        const app = new Hono();
        app.use('*', async (c, next) => {
          c.set('user', {
            id: 'user-lead-1',
            name: 'Leader',
            collegeEmail: 'lead@sonatech.ac.in',
            roles: [role],
            userType: 'STAFF',
          } as AuthPrincipal);
          await next();
        });
        app.get('/hod-route', requireHodOrAdmin, (c) => c.json({ ok: true }));

        const res = await app.request('/hod-route');
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.ok).toBe(true);
      }
    });

    it('rejects ordinary FACULTY from mutating departmental configurations', async () => {
      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('user', {
          id: 'user-faculty-1',
          name: 'Adjunct Faculty',
          collegeEmail: 'faculty@gmail.com',
          roles: ['FACULTY'],
          userType: 'STAFF',
        } as AuthPrincipal);
        await next();
      });
      app.post('/academic-mutation', requireHodOrAdmin, (c) => c.json({ created: true }));

      const res = await app.request('/academic-mutation', { method: 'POST' });
      expect(res.status).toBe(403);
    });
  });

  describe('SessionTokenService - Production JWT Secret Validation', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.JWT_SECRET;

    it('throws in production if JWT_SECRET is missing or empty', () => {
      const service = new SessionTokenService();
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      expect(() => service.getJwtSecret()).toThrow('JWT_SECRET must be configured in production environment.');

      process.env.JWT_SECRET = '   ';
      expect(() => service.getJwtSecret()).toThrow('JWT_SECRET must be configured in production environment.');

      // Restore
      process.env.NODE_ENV = originalEnv;
      if (originalSecret) process.env.JWT_SECRET = originalSecret;
    });

    it('throws in production if JWT_SECRET is less than 32 characters', () => {
      const service = new SessionTokenService();
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'short_secret_under_32_chars';

      expect(() => service.getJwtSecret()).toThrow('JWT_SECRET must be at least 32 characters long in production.');

      // Restore
      process.env.NODE_ENV = originalEnv;
      if (originalSecret) process.env.JWT_SECRET = originalSecret;
    });

    it('accepts valid 32+ character secret in production', () => {
      const service = new SessionTokenService();
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a_very_long_secure_secret_key_exceeding_32_chars_12345';

      const secretBytes = service.getJwtSecret();
      expect(secretBytes).toBeInstanceOf(Uint8Array);
      expect(secretBytes.length).toBeGreaterThanOrEqual(32);

      // Restore
      process.env.NODE_ENV = originalEnv;
      if (originalSecret) process.env.JWT_SECRET = originalSecret;
    });
  });

  describe('AttendanceAuthService - Leadership and Role Detection', () => {
    const service = new AttendanceAuthService();

    it('accurately identifies leadership roles', () => {
      const admin: AuthPrincipal = { id: '1', name: 'A', collegeEmail: 'a@s.in', roles: ['ADMIN'], userType: 'STAFF' };
      const hod: AuthPrincipal = { id: '2', name: 'H', collegeEmail: 'h@s.in', roles: ['HOD'], userType: 'STAFF' };
      const deputy: AuthPrincipal = { id: '3', name: 'D', collegeEmail: 'd@s.in', roles: ['DEPUTY_HOD'], userType: 'STAFF' };
      const staff: AuthPrincipal = { id: '4', name: 'S', collegeEmail: 's@s.in', roles: ['STAFF'], userType: 'STAFF' };
      const counselor: AuthPrincipal = { id: '5', name: 'C', collegeEmail: 'c@s.in', roles: ['CLASS_COUNSELOR', 'STAFF'], userType: 'STAFF' };
      const faculty: AuthPrincipal = { id: '6', name: 'F', collegeEmail: 'f@s.in', roles: ['FACULTY'], userType: 'STAFF' };

      expect(service.isLeadership(admin)).toBe(true);
      expect(service.isLeadership(hod)).toBe(true);
      expect(service.isLeadership(deputy)).toBe(true);
      expect(service.isLeadership(staff)).toBe(false);
      expect(service.isLeadership(counselor)).toBe(false);
      expect(service.isLeadership(faculty)).toBe(false);
    });

    it('grants session mutation directly to leadership', async () => {
      const hod: AuthPrincipal = { id: '2', name: 'H', collegeEmail: 'h@s.in', roles: ['HOD'], userType: 'STAFF' };
      const session = {
        id: 'sess-1',
        timetableId: 'tt-1',
        classId: 'class-1',
        staffId: 'staff-99',
        startedByStaffId: 'staff-99',
        sessionDate: '2026-10-25',
      };

      const canMutate = await service.canMutateSession(hod, session);
      expect(canMutate).toBe(true);
    });

    it('grants session mutation to the staff member who started it', async () => {
      const teacher: AuthPrincipal = { id: 'staff-42', name: 'Teacher', collegeEmail: 't@s.in', roles: ['STAFF'], userType: 'STAFF' };
      const session = {
        id: 'sess-1',
        timetableId: 'tt-1',
        classId: 'class-1',
        staffId: 'staff-42',
        startedByStaffId: 'staff-42',
        sessionDate: '2026-10-25',
      };

      const canMutate = await service.canMutateSession(teacher, session);
      expect(canMutate).toBe(true);
    });

    it('denies session mutation to an unauthorized third-party staff member', async () => {
      const otherTeacher: AuthPrincipal = { id: 'staff-99', name: 'Other', collegeEmail: 'o@s.in', roles: ['STAFF'], userType: 'STAFF' };
      const session = {
        id: 'sess-1',
        timetableId: 'tt-1',
        classId: 'class-1',
        staffId: 'staff-42',
        startedByStaffId: 'staff-42',
        sessionDate: '2026-10-25',
      };

      const canMutate = await service.canMutateSession(otherTeacher, session);
      expect(canMutate).toBe(false);
    });
  });
});
