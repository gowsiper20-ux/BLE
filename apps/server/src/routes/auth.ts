import { Hono } from "hono";
import { StudentRepository } from "../repositories/student.repository";
import { setCookie, deleteCookie } from "hono/cookie";
import { msAuthService } from "../services/ms-auth.service";
import { authenticate, requireHodOrAdmin, requireRole } from "../middlewares/auth.middleware";
import type { AuthPrincipal } from "@smart-attendance/shared";

export const authRoutes = new Hono();
const studentRepo = new StudentRepository();

/**
 * POST /api/auth/microsoft
 * Primary authentication endpoint for Microsoft Entra ID.
 * Accepts Microsoft access token from client, verifies signature & claims against college tenant,
 * resolves user enrollment in PostgreSQL, and establishes application session.
 */
authRoutes.post("/microsoft", async (c) => {
  try {
    let token: string | undefined;

    // Read token from Authorization header or request body
    const authHeader = c.req.header("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else {
      const body = await c.req.json().catch(() => ({}));
      token = body.token;
    }

    if (!token) {
      return c.json(
        {
          success: false,
          error: { code: "MISSING_TOKEN", message: "Microsoft access token is required." },
        },
        400
      );
    }

    // 1. Validate Microsoft token
    const claims = await msAuthService.validateMicrosoftToken(token);

    // 2. Resolve database enrollment
    const principal = await msAuthService.resolveUserIdentity(claims);

    // 3. Issue application session token
    const sessionToken = await msAuthService.createSessionToken(principal);

    // 4. Set secure cookie
    setCookie(c, "admin_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    return c.json({
      success: true,
      user: principal,
    });
  } catch (error: any) {
    const message = error.message || "Microsoft authentication failed.";
    const isUnprovisioned = message.includes("UNPROVISIONED_ACCOUNT") || message.includes("not registered");
    const isInvalidDomain = message.includes("INVALID_DOMAIN");
    const isInactive = message.includes("ACCOUNT_INACTIVE");

    const statusCode = isUnprovisioned || isInvalidDomain || isInactive ? 403 : 401;

    return c.json(
      {
        success: false,
        error: {
          code: isUnprovisioned ? "UNPROVISIONED" : isInvalidDomain ? "INVALID_DOMAIN" : "AUTH_FAILED",
          message,
        },
      },
      statusCode
    );
  }
});

/**
 * POST /api/auth/student/login
 * Local development student login
 */
authRoutes.post("/student/login", async (c) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ success: false, error: { code: "FORBIDDEN", message: "Student passwordless login is disabled in production." } }, 403);
  }

  try {
    const body = await c.req.json();
    const { username, register_number } = body;

    if (!username || !register_number || username !== register_number) {
      return c.json({ success: false, error: { message: "Username and Register Number must match." } }, 400);
    }

    const student = await studentRepo.getStudentByRegisterNumber(register_number);

    if (!student) {
      return c.json({ success: false, error: { code: "NOT_FOUND", message: "Student not found." } }, 404);
    }

    if (student.status !== "ACTIVE") {
      return c.json({ success: false, error: { code: "INACTIVE", message: "Your student account is inactive. Please contact the administrator." } }, 403);
    }

    const principal: AuthPrincipal = {
      id: student.id,
      name: student.name,
      collegeEmail: student.collegeEmail,
      roles: ["STUDENT"],
      userType: "STUDENT",
      registerNumber: student.registerNumber,
      microsoftUserId: student.microsoftUserId,
    };

    const sessionToken = await msAuthService.createSessionToken(principal);

    return c.json({ success: true, student, token: sessionToken });
  } catch (error: any) {
    return c.json({ success: false, error: { message: "Internal server error." } }, 500);
  }
});

/**
 * POST /api/auth/logout
 */
authRoutes.post("/logout", (c) => {
  deleteCookie(c, "admin_token", { path: "/" });
  return c.json({ success: true, message: "Logged out successfully" });
});

/**
 * GET /api/auth/me
 * Returns authenticated principal with all active role assignments.
 */
authRoutes.get("/me", authenticate, (c) => {
  const user = c.get("user");
  return c.json({
    success: true,
    user,
  });
});

import { msGraphService } from "../services/ms-graph.service";

/**
 * POST /api/auth/sync-directory
 * Synchronizes user accounts from Microsoft Entra ID / Microsoft Graph directory into PostgreSQL.
 */
authRoutes.post("/sync-directory", requireRole("ADMIN"), async (c) => {
  try {
    const user = c.get("user") as AuthPrincipal | undefined;
    const actor = {
      actorId: user?.id,
      actorName: user?.name || user?.collegeEmail || "System Administrator",
      actorRole: user?.roles?.[0] || "ADMIN",
      ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "127.0.0.1",
      userAgent: c.req.header("user-agent"),
    };

    const result = await msGraphService.syncDirectory(actor);
    return c.json(result);
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

/**
 * GET /api/auth/directory-status
 * Returns Microsoft Entra ID directory status and configuration details.
 */
authRoutes.get("/directory-status", requireHodOrAdmin, async (c) => {
  try {
    const data = await msGraphService.getDirectoryStatus();
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

/**
 * GET /api/auth/directory-unresolved
 * Returns list of Microsoft directory users who are not yet mapped to staff or students.
 */
authRoutes.get("/directory-unresolved", requireHodOrAdmin, async (c) => {
  try {
    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = parseInt(c.req.query("limit") || "50", 10);
    const data = await msGraphService.getUnresolvedIdentities(limit, page);
    return c.json({ success: true, ...data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

/**
 * POST /api/auth/resolve-identity
 * Manually maps an unresolved Microsoft identity to an existing staff or student record.
 */
authRoutes.post("/resolve-identity", requireHodOrAdmin, (c) => {
  return c.json({
    success: false,
    error: { code: "DIRECTORY_READ_ONLY", message: "Directory identities can only be updated by Microsoft Graph synchronization." },
  }, 405);
});

authRoutes.get("/directory-students", requireHodOrAdmin, async (c) => {
  try {
    const page = Number(c.req.query("page") || "1");
    const limit = Number(c.req.query("limit") || "20");
    const accountStatus = c.req.query("accountStatus");
    if (accountStatus && !["enabled", "disabled", "unknown"].includes(accountStatus)) {
      return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid accountStatus filter." } }, 400);
    }
    const sortBy = c.req.query("sortBy");
    if (sortBy && !["displayName", "email", "academicBatch", "academicClass", "accountEnabled"].includes(sortBy)) {
      return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid sortBy field." } }, 400);
    }
    const sortOrder = c.req.query("sortOrder");
    if (sortOrder && !["asc", "desc"].includes(sortOrder)) {
      return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid sortOrder." } }, 400);
    }
    const data = await msGraphService.getItStudents({
      search: c.req.query("search"),
      academicBatch: c.req.query("academicBatch"),
      academicClass: c.req.query("academicClass"),
      accountStatus: accountStatus as "enabled" | "disabled" | "unknown" | undefined,
      page,
      limit,
      sortBy: sortBy as "displayName" | "email" | "academicBatch" | "academicClass" | "accountEnabled" | undefined,
      sortOrder: sortOrder as "asc" | "desc" | undefined,
    });
    return c.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Directory student query failed.";
    const status = message.startsWith("INVALID_") ? 400 : 500;
    return c.json({ success: false, error: { message } }, status);
  }
});

authRoutes.get("/directory-staff", requireHodOrAdmin, async (c) => {
  try {
    const page = Number(c.req.query("page") || "1");
    const limit = Number(c.req.query("limit") || "20");
    const accountStatus = c.req.query("accountStatus");
    if (accountStatus && !["enabled", "disabled", "unknown"].includes(accountStatus)) {
      return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid accountStatus filter." } }, 400);
    }
    const sortBy = c.req.query("sortBy");
    if (sortBy && !["displayName", "email", "academicBatch", "academicClass", "accountEnabled"].includes(sortBy)) {
      return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid sortBy field." } }, 400);
    }
    const sortOrder = c.req.query("sortOrder");
    if (sortOrder && !["asc", "desc"].includes(sortOrder)) {
      return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid sortOrder." } }, 400);
    }
    const data = await msGraphService.getItStaff({
      search: c.req.query("search"),
      accountStatus: accountStatus as "enabled" | "disabled" | "unknown" | undefined,
      page,
      limit,
      sortBy: sortBy as "displayName" | "email" | "academicBatch" | "academicClass" | "accountEnabled" | undefined,
      sortOrder: sortOrder as "asc" | "desc" | undefined,
    });
    return c.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Directory staff query failed.";
    const status = message.startsWith("INVALID_") ? 400 : 500;
    return c.json({ success: false, error: { message } }, status);
  }
});
