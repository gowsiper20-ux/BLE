import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { msAuthService } from '../services/ms-auth.service';
import { db } from '../db';
import { classCounselors } from '../db/schema/staff';
import { eq, and } from 'drizzle-orm';
import type { UserRole, AuthPrincipal } from '@smart-attendance/shared';

// Extend Hono Context Variables
declare module 'hono' {
  interface ContextVariableMap {
    user: AuthPrincipal;
    student?: any;
  }
}

/**
 * Global authentication middleware.
 * Resolves identity from either an application session JWT or a direct Microsoft Entra access token.
 */
export const authenticate = async (c: Context, next: Next) => {
  const adminToken = getCookie(c, 'admin_token');
  const authHeader = c.req.header('Authorization');
  let token: string | undefined = adminToken;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1]?.trim();
  }

  if (!token) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required. No bearer token or session cookie provided.' } }, 401);
  }

  try {
    let principal: AuthPrincipal | null = null;

    // 1. Try verifying as an internal session JWT
    try {
      principal = await msAuthService.verifySessionToken(token);
    } catch (sessionErr: any) {
      // 2. If not a valid session token, try verifying directly as a Microsoft Entra ID token
      try {
        const claims = await msAuthService.validateMicrosoftToken(token);
        principal = await msAuthService.resolveUserIdentity(claims);
      } catch (msErr: any) {
        return c.json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: msErr.message || 'Token verification failed.',
          },
        }, 401);
      }
    }

    if (!principal) {
      return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unable to resolve identity.' } }, 401);
    }

    c.set('user', principal);
    await next();
  } catch (err: any) {
    return c.json({
      success: false,
      error: {
        code: 'AUTH_FAILED',
        message: err.message || 'Authentication error.',
      },
    }, 401);
  }
};

/**
 * RBAC middleware: requires the authenticated principal to have at least one of the specified roles.
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as AuthPrincipal | undefined;

    if (!user) {
      return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } }, 401);
    }

    const hasAllowedRole = user.roles.some((role) => allowedRoles.includes(role));

    if (!hasAllowedRole) {
      return c.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Required role: [${allowedRoles.join(', ')}]. Your active roles: [${user.roles.join(', ')}].`,
        },
      }, 403);
    }

    await next();
  };
};

/**
 * Backward compatibility: Require ADMIN role
 */
export const requireAdminAuth = async (c: Context, next: Next) => {
  let user = c.get('user') as AuthPrincipal | undefined;
  if (!user) {
    const authRes = await authenticate(c, async () => {
      user = c.get('user') as AuthPrincipal | undefined;
    });
    if (authRes) return authRes;
  }

  user = c.get('user') as AuthPrincipal | undefined;
  if (!user?.roles?.includes('ADMIN')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden: Admin access required.' } }, 403);
  }

  await next();
};

/**
 * Department-level oversight: ADMIN, HOD, or DEPUTY_HOD
 */
export const requireHodOrAdmin = requireRole('ADMIN', 'HOD', 'DEPUTY_HOD');

/**
 * Any staff member or administrator
 */
export const requireStaffOrAdmin = requireRole('ADMIN', 'HOD', 'DEPUTY_HOD', 'CLASS_COUNSELOR', 'STAFF');

/**
 * Class-level resource authorization check:
 * Allows ADMIN, HOD, DEPUTY_HOD unconditionally, or CLASS_COUNSELOR if assigned to the target classId.
 */
export const requireClassCounselorOrAdmin = (getClassId: (c: Context) => string | undefined) => {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as AuthPrincipal;
    if (!user) {
      return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } }, 401);
    }

    // Admins and HODs have department-wide class access
    if (user.roles.includes('ADMIN') || user.roles.includes('HOD') || user.roles.includes('DEPUTY_HOD')) {
      return next();
    }

    // Class counselor check
    if (user.roles.includes('CLASS_COUNSELOR')) {
      const classId = getClassId(c);
      if (!classId) {
        return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Class identifier is required for access verification.' } }, 400);
      }

      const assignment = await db
        .select()
        .from(classCounselors)
        .where(
          and(
            eq(classCounselors.staffId, user.id),
            eq(classCounselors.classId, classId),
            eq(classCounselors.status, 'ACTIVE')
          )
        )
        .then((rows) => rows[0]);

      if (assignment) {
        return next();
      }
    }

    return c.json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied: You are not authorized to view or manage this class.',
      },
    }, 403);
  };
};

/**
 * Student authentication middleware
 */
export const requireStudentAuth = async (c: Context, next: Next) => {
  let user = c.get('user') as AuthPrincipal | undefined;
  if (!user) {
    const authRes = await authenticate(c, async () => {
      user = c.get('user') as AuthPrincipal | undefined;
    });
    if (authRes) return authRes;
  }

  user = c.get('user') as AuthPrincipal | undefined;
  if (user?.userType !== 'STUDENT' && !user?.roles?.includes('STUDENT')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Student access required.' } }, 403);
  }

  c.set('student', user);
  await next();
};
