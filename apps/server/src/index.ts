import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import "dotenv/config";

import { authRoutes } from "./routes/auth";
import { academicRoutes } from "./routes/academic";
import { studentRoutes } from "./routes/students";
import { staffRoutes } from "./routes/staff";
import { roleRoutes } from "./routes/roles";
import { counselorRoutes } from "./routes/class-counselors";
import { subjectRoutes } from "./routes/subjects";
import { classSubjectRoutes } from "./routes/class-subjects";
import { timetableRoutes } from "./routes/timetable";
import { periodRoutes } from "./routes/periods";
import { attendanceRoutes } from "./routes/attendance";
import { auditRoutes } from "./routes/audit";
import { settingsRoutes } from "./routes/settings";
import { dashboardRoutes } from "./routes/dashboard";
import { authenticate } from "./middlewares/auth.middleware";
import { msGraphService } from "./services/ms-graph.service";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Health check
app.get("/", (c) => {
  return c.json({
    message: "Smart Attendance API",
    status: "running",
    version: "0.1.0",
  });
});

// Global Auth Middleware
app.use("/api/*", async (c, next) => {
  const path = c.req.path;
  
  // Whitelist paths that don't need authentication
  const whitelist = [
    "/api/auth/student/login",
    "/api/auth/microsoft",
    "/api/auth/logout",
  ];
  
  if (whitelist.includes(path) || path.startsWith("/api/students/me/")) {
    return next();
  }
  
  return authenticate(c, next);
});

// Mount routes
app.route("/api/auth", authRoutes);
app.route("/api", academicRoutes);
app.route("/api/students", studentRoutes);
app.route("/api/staff", staffRoutes);
app.route("/api/roles", roleRoutes);
app.route("/api/class-counselors", counselorRoutes);
app.route("/api/subjects", subjectRoutes);
app.route("/api/class-subjects", classSubjectRoutes);
app.route("/api/timetable", timetableRoutes);
app.route("/api/periods", periodRoutes);
app.route("/api/attendance", attendanceRoutes);
app.route("/api/audit", auditRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/dashboard", dashboardRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Server error:", err);
  return c.json({ error: "Internal Server Error" }, 500);
});

const port = parseInt(process.env.PORT || "3000", 10);

if (process.env.NODE_ENV !== 'test') {
  const syncIntervalMinutes = Number(process.env.MICROSOFT_SYNC_INTERVAL_MINUTES || "0");
  if (!Number.isInteger(syncIntervalMinutes) || syncIntervalMinutes < 0 || syncIntervalMinutes > 10_080) {
    throw new Error("MICROSOFT_SYNC_INTERVAL_MINUTES must be an integer between 0 and 10080.");
  }
  if (syncIntervalMinutes > 0) {
    if (!msGraphService.isConfigured()) {
      throw new Error("Scheduled directory sync requires MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, and MICROSOFT_CLIENT_SECRET.");
    }
    const timer = setInterval(() => {
      void msGraphService.syncDirectory().catch((error: unknown) => {
        const errorType = error instanceof Error ? error.name : "UnknownError";
        console.error("Scheduled Microsoft Graph synchronization failed.", { errorType });
      });
    }, syncIntervalMinutes * 60_000);
    timer.unref();
    console.info("Microsoft Graph synchronization scheduler enabled.", { intervalMinutes: syncIntervalMinutes });
  }

  serve(
    {
      fetch: app.fetch,
      port,
      hostname: "0.0.0.0",
    },
    (info) => {
      console.log(`🚀 Smart Attendance API running on http://${info.address === '0.0.0.0' ? 'localhost' : info.address}:${info.port} (and LAN)`);
    }
  );
}

export default app;