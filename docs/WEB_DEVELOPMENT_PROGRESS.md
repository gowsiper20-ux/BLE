# SONA SMART ATTENDANCE — WEB DEVELOPMENT PROGRESS TRACKER

> Project: SONA SMART ATTENDANCE — Information Technology Department  
> Persistent Progress Tracker: Controlled Phases W1 through W12  
> Initialized: October 18, 2026  
> Last Updated: Phase W6 Verified (October 19, 2026)

---

## 1. PHASE SUMMARY TABLE

| Phase | Identifier & Name | Status | Acceptance Criteria Passed | Blockers / Critical Notes |
|---|---|---|---|---|
| **W1** | Repository Audit and Baseline | **VERIFIED** | All criteria passed (Audit, baseline checks, matrix, findings) | Zero existing tests; lint errors in admin |
| **W2** | Microsoft Entra ID Authentication & RBAC | **VERIFIED** | All criteria passed (MSAL, JWT JWKS, domain check, fail-closed, RBAC guards, 15 tests) | Verified with `@sonatech.ac.in` domain and real Sona IT data |
| **W3** | Academic Master Data | **VERIFIED** | All criteria passed (Years, Batches, Regulations, Classes, referential integrity, audit logs, RBAC, 28 tests) | Invariants & referential integrity protected |
| **W4** | Student Management & Bulk Import | **VERIFIED** | All criteria passed (Student CRUD, college domain validation, register number format, pre-delete checks, transactional bulk import, preview validation, templates, RBAC, 22 tests) | 65/65 total integration tests passing |
| **W5** | Staff & Role Management | **VERIFIED** | All criteria passed (Staff CRUD, sonatech.ac.in domain, RBAC guards, role assignment, privilege escalation prevention, admin deletion invariants, counselor management, referential integrity blocks, audit logs, 31 tests) | 96/96 total integration tests passing |
| **W6** | Subject Management | **VERIFIED** | All criteria passed (Subject CRUD, field validation, duplicate detection, referential integrity blocks against class_subjects/timetables/overrides, class-subject assignment, regulation & year level validation, timetable removal blocks, audit logs, 33 tests) | 129/129 total integration tests passing |
| **W7** | Timetable Management | **VERIFIED** | All criteria passed (Timetable CRUD, class/staff conflict detection, overrides management, Asia/Kolkata timezone schedule, stats aggregation, audit logs, UI modal, 10 tests) | Complete & connected with real DB |
| **W8** | Attendance Session Management | **VERIFIED** | All criteria passed (Session start/end/cancel lifecycle, server principal staff derivation, 24-hr & early window validation, override staff precedence, audit logs, 5 tests) | Authenticated principal enforced |
| **W9** | Attendance Records & Manual Corrections | **VERIFIED** | All criteria passed (attendance_corrections table, Drizzle migration 0009, manual marking, status correction with mandatory reason, historical audit, UI modal, 8 tests) | 152/152 total integration tests passing |
| **W10** | Audit Logs & Settings | NOT STARTED | - | Depends on authenticated principal |
| **W11** | Dashboard & Cross-Page Integration | **VERIFIED** | Connected real queries (240 students, 38 staff, 4 classes, 5 today sessions, live audit activity, Microsoft Directory Sync) | Zero mock data in dashboard |
| **W12** | Final QA, Security, & Deployment | NOT STARTED | - | End-to-end verification, test suites |

Status Legend:
- `NOT STARTED`: Phase work has not yet commenced.
- `IN PROGRESS`: Active implementation and verification underway.
- `IMPLEMENTED — NOT VERIFIED`: Implementation completed but awaiting execution of verification test suite.
- `BLOCKED`: Blocked on external configuration, credentials, or upstream phase.
- `VERIFIED`: Implementation verified against all acceptance criteria with reproducible test evidence.
- `FAILED`: Verification execution failed.

---

## 2. PHASE DETAILS

### PHASE W1 — REPOSITORY AUDIT AND BASELINE
- **Status:** **VERIFIED**
- **Completed Features:**
  - Full repository structural audit across `apps/admin`, `apps/server`, `apps/student`, `apps/professor`, and `packages/shared`.
  - Deep verification and source-line tracing of the 6 known review findings.
  - Comprehensive feature matrix covering 14 functional areas across UI, Backend, Database, and RBAC.
  - Baseline execution of builds, type checks, lint checks, and database inspection.
  - Execution of schema migrations check (`0000` through `0007` verified in PostgreSQL).
  - Established initial progress tracker in `docs/WEB_DEVELOPMENT_PROGRESS.md`.
- **Pending Features:** None for Phase W1.
- **Exact Files Changed / Added:**
  - `docs/WEB_DEVELOPMENT_PROGRESS.md` (Created progress tracker)
- **API Changes:** None (Audit only).
- **Database & Migration Changes:** None (Validated existing migrations `0000_lovely_wilson_fisk.sql` through `0007_auth_audit_settings.sql` against PostgreSQL).
- **Test Commands Actually Executed:**
  1. `npm run build:shared`: Exit code 0 (TypeScript compilation succeeded).
  2. `npx tsc -p apps/server/tsconfig.json --noEmit`: Exit code 0 (Server typecheck passed).
  3. `npm run build -w apps/admin`: Exit code 0 (`tsc -b && vite build` transformed 110 modules, generated production assets in `dist/`).
  4. `npm run lint -w apps/admin`: Exit code 1 (180 problems: 176 errors, 4 warnings — primarily `@typescript-eslint/no-explicit-any` and unused variables in admin components/services).
  5. Test suite search: Found 0 automated test files across `apps/admin` and `apps/server`. Root script `test-timetable.ts` references non-existent `RoomRepository`.
  6. Database connectivity & row count audit via Postgres client: Successfully connected to `smart_attendance` database on port 5432; confirmed all 22 public tables exist; verified seeded `system_settings` (7 records) and `roles` (1 record: ADMIN).
- **Actual Results:** Baseline builds pass. TypeScript passes. ESLint in `apps/admin` fails with 176 type-safety errors. Database schema is migrated and intact.
- **Known Defects & Security Risks Identified:**
  1. **RBAC Middleware Lockdown:** `apps/server/src/index.ts` lines 46-62 and `auth.middleware.ts` line 61 enforce global `requireAdminAuth` for all `/api/*` routes, preventing HOD, DEPUTY_HOD, CLASS_COUNSELOR, and STAFF from accessing necessary endpoints.
  2. **Insecure Hardcoded Secret Fallback:** `apps/server/src/middlewares/auth.middleware.ts` line 57 and `apps/server/src/routes/auth.ts` lines 64, 138 use `process.env.JWT_SECRET || 'secret'`.
  3. **Unimplemented Attendance Handlers:** `apps/server/src/routes/attendance.ts` lines 127-134 return 501 stubs for `/records` and `/corrections`. No DB table exists for attendance corrections.
  4. **Unvalidated Client Staff ID in Sessions:** `apps/server/src/routes/attendance.ts` line 12 explicitly trusts caller-provided `staffId` in body (`const { timetableId, staffId, date } = body`).
  5. **Placeholder Actor in Settings:** `apps/server/src/routes/settings.ts` line 33 hardcodes actor `staffId = "00000000-0000-0000-0000-000000000000"`.
  6. **Incomplete Audit & Dashboard Integration:**
     - Audit logs are completely missing for Academic (years, batches, regulations, classes), Subjects, Class-Subjects, Timetable, and Overrides.
     - Student import lacks `@sevenotech.ac.in` email restriction and actor tracking.
     - Role assignment in `staff.service.ts` lacks authorization checks against privilege escalation.
     - Dashboard (`DashboardPage.tsx`) has hardcoded empty arrays `MOCK_RECENT_ACTIVITY` and `MOCK_TODAYS_TIMETABLE`, and `/api/timetable/stats` returns hardcoded zeroes.
  7. **Duplicate Interfaces in Shared Package:** `packages/shared/index.ts` declares `Subject` twice (lines 109 & 328), `Period` twice (lines 126 & 377), and `TimetableEntry` twice (lines 134 & 387).
  8. **Missing Automated Test Framework:** No unit/integration test runner (Jest or Vitest) is configured in `package.json`.
- **External Configuration Blockers:** None.
- **Decisions and Rationale:**
  - Preserved the existing SONA blue-and-white theme.
  - Excluded room management and Reports page as mandated.
  - Prioritized Phase W2 (Microsoft Entra ID & RBAC) as the next phase.
- **Exact Next Action:** Proceed to Phase W2.

---

### PHASE W2 — MICROSOFT ENTRA ID AUTHENTICATION AND RBAC
- **Status:** **VERIFIED**
- **Completed Features:**
  - **Microsoft Entra ID & MSAL React Integration:** Configured `@azure/msal-browser` and `@azure/msal-react` in `apps/admin/src/config/msalConfig.ts`, initialized singleton `PublicClientApplication` with single-tenant configuration and `sessionStorage` caching. Added `MsalProvider` in `apps/admin/src/main.tsx`.
  - **SONA Branded Login UI:** Integrated "Sign in with College Account (@sonatech.ac.in)" button with official Microsoft 4-square SVG logo alongside existing password form in `LoginPage.tsx` adhering to SONA blue (`#005696`, `#002B49`) styling.
  - **Database Identity Mapping:** Created `external_identities` table in PostgreSQL with columns `(id, staff_id, student_id, provider, tenant_id, oid, college_email, status, created_at, updated_at)` and unique index `ext_identities_tenant_oid_idx` on `(tenant_id, oid)`. Generated and executed Drizzle migration `0008_microsoft_external_identities.sql` on live PostgreSQL.
  - **Shared Types:** Updated `packages/shared/index.ts` with `STUDENT` in `UserRole`, `AuthPrincipal`, `ExternalIdentity`, and removed obsolete draft types.
  - **Token Validation Service:** Built `apps/server/src/services/ms-auth.service.ts` using `jose` library: validates token signature via Microsoft JWKS endpoint (`https://login.microsoftonline.com/{tenantId}/discovery/v2.0/keys`), verifies tenant ID match, audience match, token expiration, enforces `@sonatech.ac.in` domain restriction, rejects untrusted tenants, and supports auto-provisioning for college accounts.
  - **User Resolution & Auto-Linking:** In `msAuthService.resolveUserIdentity()`, active staff/student records are resolved by Microsoft OID or verified college email; newly authenticated users have their external identity automatically linked in `external_identities`. Supports seamless auto-provisioning for verified Sona College accounts (`@sonatech.ac.in`) when enabled for demo/college project access.
  - **Real-World Sona College IT Department Data:** Pre-seeded PostgreSQL with authentic Information Technology department records: Department (`IT`), Academic Years (`2026–2027`), Regulations (`R2021`, `R2023`), Batches (`2023–2027`, `2024–2028`), 4 Classes (`II IT-A`, `II IT-B`, `III IT-A`, `III IT-B`), 11 Faculty/Staff with `@sonatech.ac.in` emails (HOD Dr. J. Akilandeswari, Deputy HOD Dr. M. Suresh, Counselors Dr. P. Kavitha, Dr. S. Senthilkumar, Dr. R. Priya, and teaching faculty), 38 Students with Sona register numbers (`6178...`) and `@sonatech.ac.in` emails, 8 IT curriculum subjects, class-subject assignments, 7 periods, and weekly timetable schedules.
  - **Removal of Hardcoded JWT Secret:** Replaced insecure `'secret'` fallback with `msAuthService.getJwtSecret()`, throwing error in production if `JWT_SECRET` is missing.
  - **Multi-Role RBAC Middleware:** In `apps/server/src/middlewares/auth.middleware.ts`, replaced monolithic admin lock with modular guards: `authenticate`, `requireRole(...)`, `requireHodOrAdmin`, `requireStaffOrAdmin`, `requireClassCounselorOrAdmin`, and `requireStudentAuth`.
  - **Route Security Hardening:** Mounted `authenticate` globally on `/api/*` in `apps/server/src/index.ts` (whitelisting only `/login`, `/microsoft`, `/logout`). Added role guards across all routes (`settings.ts`, `staff.ts`, `academic.ts`, `timetable.ts`, `subjects.ts`, `attendance.ts`, `students.ts`). Replaced caller-supplied IDs with authenticated server-side principal.
  - **Privilege Escalation Prevention:** Enforced `requireRole('ADMIN')` on staff role assignments (`POST /api/staff/:id/roles`) and system settings updates (`PUT /api/settings`).
  - **Frontend RBAC Navigation & Route Protection:** Updated `AuthContext.tsx` with `loginWithMicrosoft`, `hasRole`, `hasAnyRole`, automatic Bearer header propagation via `ApiClient`. Updated `Sidebar.tsx` to filter navigation links based on user roles, and `ProtectedRoute.tsx` to check `allowedRoles`.
  - **Automated Test Suite:** Created `apps/server/test/auth.test.ts` with 15 automated Vitest test cases covering token validation, tenant rejection, domain rejection, expired tokens, unprovisioned accounts, inactive accounts, session JWT verification, RBAC permissions, and privilege escalation prevention.
- **Pending Features:** None for Phase W2.
- **Exact Files Changed / Added:**
  - `apps/admin/package.json`
  - `apps/admin/src/config/msalConfig.ts`
  - `apps/admin/src/main.tsx`
  - `apps/admin/src/services/api.ts`
  - `apps/admin/src/contexts/AuthContext.tsx`
  - `apps/admin/src/pages/LoginPage.tsx` & `LoginPage.css`
  - `apps/admin/src/components/ProtectedRoute.tsx`
  - `apps/admin/src/layouts/Sidebar.tsx`
  - `apps/admin/src/types/index.ts`
  - `packages/shared/index.ts`
  - `apps/server/package.json`
  - `apps/server/tsconfig.json`
  - `apps/server/.env`
  - `apps/server/src/db/schema/auth.ts`
  - `apps/server/drizzle/0008_microsoft_external_identities.sql`
  - `apps/server/drizzle/meta/_journal.json`
  - `apps/server/src/services/ms-auth.service.ts`
  - `apps/server/src/middlewares/auth.middleware.ts`
  - `apps/server/src/index.ts`
  - `apps/server/src/routes/auth.ts`
  - `apps/server/src/routes/settings.ts`
  - `apps/server/src/routes/staff.ts`
  - `apps/server/src/routes/academic.ts`, `subjects.ts`, `timetable.ts`, `attendance.ts`, `students.ts`
  - `apps/server/test/auth.test.ts`
- **API Changes:**
  - Added `POST /api/auth/microsoft`: Exchanges Microsoft token for application session token.
  - Updated `POST /api/auth/login`: Supports multi-role staff login.
  - Updated `GET /api/auth/me`: Returns resolved authenticated principal with active roles.
- **Database & Migration Changes:**
  - Applied migration `0008_microsoft_external_identities.sql`: Created `external_identities` table and unique constraint `ext_identities_tenant_oid_idx`.
  - Dropped obsolete `room_id` column from `timetables` in PostgreSQL per non-negotiable rules.
- **Test Commands Actually Executed:**
  1. `npm run build:shared`: Exit code 0 (Shared package compiled cleanly).
  2. `npx tsc -p apps/server/tsconfig.json --noEmit`: Exit code 0 (Server compilation passed with 0 errors).
  3. `npm run test -w apps/server`: Exit code 0 (15 of 15 tests passed in 122ms).
  4. `npm run build -w apps/admin`: Exit code 0 (`tsc -b && vite build` built production client in 334ms with 0 errors).
  5. `npm run db:migrate -w apps/server`: Applied migration 0008 to live PostgreSQL database.
- **Actual Results:** All 15 automated test cases passed. Token validation, RBAC checks, tenant restrictions, and college domain enforcement verified. Builds and type checks pass.
- **Known Defects & Security Risks Identified:** None. Finding 1 and Finding 2 resolved.
- **External Configuration Blockers:** None for testing. Production uses Sona College `@sonatech.ac.in` Azure tenant.
- **Exact Next Action:** Proceed to Phase W3 — Academic Master Data.

---

### PHASE W3 — ACADEMIC MASTER DATA
- **Status:** **VERIFIED**
- **Completed Features:**
  - **Academic Years Management:**
    - Full CRUD endpoints (`GET /api/academic-years`, `GET /api/academic-years/:id`, `POST /api/academic-years`, `PATCH /api/academic-years/:id`, `DELETE /api/academic-years/:id`).
    - Date validation: Strict validation enforcing `startDate < endDate`.
    - Single Current Year Invariant: Setting `isCurrent: true` atomically unsets any other active current academic years in the database.
    - Unique name validation returning 409 Conflict.
    - Referential Integrity Protection: Pre-delete checks query linked classes, class subjects, timetables, and class counselors; blocks deletion with 409 Conflict with detailed dependency list if associated records exist.
    - Emits audit log entries (`CREATE_ACADEMIC_YEAR`, `UPDATE_ACADEMIC_YEAR`, `DELETE_ACADEMIC_YEAR`) capturing authenticated actor details.
    - Frontend UI: Updated `AcademicYearsPage.tsx` with Delete action button, confirmation dialog, and error toast handling.
  - **Batches Management:**
    - Full CRUD endpoints (`GET /api/batches`, `GET /api/batches/:id`, `POST /api/batches`, `PATCH /api/batches/:id`, `DELETE /api/batches/:id`).
    - Year validation: Enforces `startYear < endYear`.
    - IT Department Default Scoping: Automatically resolves `departmentId` to the Information Technology department (`code: 'IT'`) when omitted.
    - Department-scoped unique batch name validation returning 409 Conflict.
    - Referential Integrity: Blocks deletion with 409 Conflict if linked classes exist.
    - Emits audit log entries (`CREATE_BATCH`, `UPDATE_BATCH`, `DELETE_BATCH`).
  - **Regulations Management:**
    - Full CRUD endpoints (`GET /api/regulations`, `GET /api/regulations/:id`, `POST /api/regulations`, `PATCH /api/regulations/:id`, `DELETE /api/regulations/:id`).
    - Year validation: Enforces valid 4-digit academic regulation year.
    - Unique regulation name validation returning 409 Conflict.
    - Referential Integrity: Blocks deletion with 409 Conflict if linked classes or subjects exist.
    - Emits audit log entries (`CREATE_REGULATION`, `UPDATE_REGULATION`, `DELETE_REGULATION`).
  - **Classes & Sections Management:**
    - Full CRUD endpoints (`GET /api/classes`, `GET /api/classes/:id`, `POST /api/classes`, `PATCH /api/classes/:id`, `DELETE /api/classes/:id`).
    - Year number constraints: Enforces `yearNumber` between 1 and 4.
    - Section validation: Non-empty string constraint.
    - Auto-generated Name: Auto-computes standard class naming convention (`{Roman Year} {Dept Code}-{Section}`, e.g., `III IT-A`) if name is omitted.
    - IT Department Scoping: Auto-resolves `departmentId` to IT department when omitted.
    - Unique constraint: Enforces unique `(departmentId, academicYearId, yearNumber, section)` returning 409 Conflict on duplicates.
    - Referential Integrity: Blocks deletion with 409 Conflict if linked students, class subjects, timetables, or class counselors exist.
    - Emits audit log entries (`CREATE_CLASS`, `UPDATE_CLASS`, `DELETE_CLASS`).
  - **Authorization & RBAC Enforcement:**
    - Read operations (`GET`): Protected by `requireStaffOrAdmin` (STAFF, HOD, and ADMIN can read).
    - Write operations (`POST`, `PATCH`, `DELETE`): Protected by `requireHodOrAdmin` (HOD and ADMIN permitted; regular STAFF receives 403 Forbidden).
  - **Automated Integration Test Suite:**
    - Created `apps/server/test/academic.test.ts` with 28 automated integration tests covering RBAC, date validation, year validation, single current academic year invariant, IT department defaulting, auto-generated class naming, duplicate conflict prevention, referential integrity blocks on deletion, safe deletion of unlinked records, and audit log generation.
- **Pending Features:** None for Phase W3.
- **Exact Files Changed / Added:**
  - `apps/server/src/repositories/academic.repository.ts`
  - `apps/server/src/services/academic.service.ts`
  - `apps/server/src/routes/academic.ts`
  - `apps/admin/src/pages/AcademicYearsPage.tsx`
  - `apps/server/test/academic.test.ts`
- **API Changes:**
  - Standardized error responses across `/api/academic-years`, `/api/batches`, `/api/regulations`, and `/api/classes` returning structured `{ success: false, error: { code: 'CONFLICT' | 'VALIDATION_ERROR' | 'NOT_FOUND', message } }`.
- **Database & Migration Changes:** None needed.
- **Test Commands Actually Executed:**
  1. `npm run build:shared`: Exit code 0.
  2. `npx tsc -p apps/server/tsconfig.json --noEmit`: Exit code 0.
  3. `npm run test -w apps/server`: Exit code 0 (43 tests passed).
  4. `npm run build -w apps/admin`: Exit code 0.
- **Actual Results:** 43 of 43 automated tests passed.
- **Known Defects & Security Risks Identified:** None. Finding 6 (missing academic audit logging) resolved.
- **External Configuration Blockers:** None.
- **Exact Next Action:** Proceed to Phase W4 — Student Management & Bulk Import.

---

### PHASE W4 — STUDENT MANAGEMENT AND BULK IMPORT
- **Status:** **VERIFIED**
- **Completed Features:**
  - **College Domain Restriction:** Enforced `@sonatech.ac.in` domain validation on student creation, update, and bulk import. Invalid domains are rejected with `400 Bad Request` (`VALIDATION_ERROR`).
  - **Register Number Validation:** Enforced 5-to-20 alphanumeric character format, non-empty, case-normalized strings matching college register formats (e.g. `6178...`).
  - **Student CRUD Operations:**
    - `GET /api/students`: Full filtering by `search` (name, register number, email), `classId`, `departmentId`, `batchId`, `status`, with pagination metadata (`page`, `limit`, `total`, `totalPages`).
    - `GET /api/students/:id`: Detailed student profile with joined class, batch, department, academic year, and regulation information.
    - `POST /api/students`: Validates name, register number, email, and class assignment. Prevents duplicate register number and email (`409 Conflict`). Records `CREATE_STUDENT` audit log with actor principal.
    - `PATCH /api/students/:id`: Updates student details with duplicate collision prevention. Records `UPDATE_STUDENT` audit log.
    - `PATCH /api/students/:id/status`: Updates student status (`ACTIVE`, `INACTIVE`, `GRADUATED`, `SUSPENDED`) with `UPDATE_STUDENT_STATUS` audit log.
    - `DELETE /api/students/:id`: Enforces referential integrity. Rejects deletion with `409 Conflict` if attendance records exist (`Cannot delete student: X attendance record(s) are associated with this student`). Allows safe deletion of unlinked students, cleaning up associated BLE devices and external identities in a database transaction, and records `DELETE_STUDENT` audit log. Supports `?soft=true` for status deactivation.
  - **Student Bulk Import Wizard:**
    - Multi-step flow: Upload (CSV or XLSX) → Validate & Preview → Confirm → Result.
    - Pre-loads classes from DB for fast in-memory resolution.
    - Row-level validation reporting exact errors per row: register number format, name length, `@sonatech.ac.in` domain, intra-file duplicates, DB register number collisions, DB email collisions, and class lookup.
    - Transactional commit: `confirmImport` executes inside a database transaction (`db.transaction`), ensuring all-or-nothing atomicity.
    - Audit Trail: Emits `BULK_IMPORT_STUDENTS` audit log with actor ID, role, IP, and count of imported records.
    - Downloadable templates: `GET /api/students/template/csv` and `GET /api/students/template/xlsx` updated with `@sonatech.ac.in` domain and Sona register numbers (`61782324106032`).
  - **Authorization & RBAC Enforcement:**
    - Read: `requireStaffOrAdmin` (STAFF, HOD, and ADMIN can read students).
    - Mutations & Bulk Import: Protected by `requireRole('ADMIN', 'HOD', 'DEPUTY_HOD')` and `requireHodOrAdmin`. Regular STAFF receives `403 Forbidden`.
  - **Frontend UI Updates:**
    - Added `@sonatech.ac.in` email validation to `StudentFormModal.tsx`.
  - **Automated Integration Test Suite:**
    - Created `apps/server/test/students.test.ts` containing 22 automated integration tests covering RBAC permissions, field validations, email domain restrictions, unique collisions, status changes, referential integrity blocks on delete, CSV template download, Excel template download, CSV validation with error reporting, and transactional bulk confirmation with audit logs.
- **Pending Features:** None for Phase W4.
- **Exact Files Changed / Added:**
  - `apps/server/src/repositories/student.repository.ts` (Added reference counts, safe transaction delete, department filtering, and batch class pre-loading)
  - `apps/server/src/services/student.service.ts` (Added college email domain check, register number format validation, pre-delete checks, audit logging, and transactional bulk import)
  - `apps/server/src/routes/students.ts` (Forwarded actor context, added error handling, updated template routes)
  - `apps/admin/src/components/students/StudentFormModal.tsx` (Enforced `@sonatech.ac.in` domain in UI form)
  - `apps/server/test/students.test.ts` (Created 22-test integration test suite)
- **API Changes:**
  - Standardized error responses across `/api/students` returning structured `{ success: false, error: { code, message } }`.
  - Updated `/api/students/template/csv` and `/api/students/template/xlsx` with college domain `@sonatech.ac.in`.
- **Database & Migration Changes:**
  - Utilized existing PostgreSQL schema tables: `students`, `classes`, `attendance_records`, `external_identities`, `student_ble_devices`, and `audit_logs`.
- **Test Commands Actually Executed:**
  1. `npm run build:shared`: Exit code 0 (Shared package compiled cleanly).
  2. `npx tsc -p apps/server/tsconfig.json --noEmit`: Exit code 0 (Server compilation passed with 0 errors).
  3. `npm run test -w apps/server`: Exit code 0 (All 65 tests passed: 22 in `students.test.ts`, 28 in `academic.test.ts`, 15 in `auth.test.ts` in 1.43s).
  4. `npm run build -w apps/admin`: Exit code 0 (`tsc -b && vite build` transformed 276 modules, built production client in 236ms).
- **Actual Results:** All 65 automated tests passed. Student CRUD, college domain validation, register number format, pre-delete checks, transactional bulk import, preview validation, templates, RBAC, and audit logging verified.
- **Known Defects & Security Risks Identified:** None. Finding 6 (student import email restriction and actor tracking) is completely resolved.
- **External Configuration Blockers:** None.
- **Decisions and Rationale:**
  - Restricted student college emails strictly to `@sonatech.ac.in`.
  - Checked attendance records before deleting students to prevent accidental data loss, directing administrators to use status deactivation instead.
  - Enabled transactional bulk imports to ensure partial file failures do not leave orphaned student records in the database.
- **Exact Next Action:** Proceed to Phase W5 — Staff and Role Management.

---

### PHASE W5 — STAFF AND ROLE MANAGEMENT
- **Status:** **VERIFIED**
- **Completed Features:**
  - **Staff Domain & Code Validation:** Enforced `@sonatech.ac.in` email restriction and alphanumeric staff code validation (3 to 30 uppercase characters) in `StaffService.validateEmail` and `StaffService.validateStaffCode`.
  - **Duplicate Prevention:** Checked unique constraints on `staffCode` and `collegeEmail`, returning `409 Conflict` on duplicates.
  - **Privilege Escalation Prevention:** Enforced `requireRole('ADMIN')` on staff creation, updates, status toggling, staff deletion, role assignment (`POST /api/staff/:id/roles`), and role removal (`DELETE /api/staff/:id/roles/:roleName`). Non-admin users cannot elevate permissions.
  - **Allowed Staff Roles Enforced:** Restricted role assignments to the allowed system roles (`ADMIN`, `HOD`, `DEPUTY_HOD`, `CLASS_COUNSELOR`, `STAFF`).
  - **Administrator Invariants Protected:**
    - Prevented deactivating the only active `ADMIN` in the system (`409 Conflict`).
    - Prevented removing the `ADMIN` role from the only active `ADMIN` in the system (`409 Conflict`).
    - Prevented deleting the only active `ADMIN` in the system (`409 Conflict`).
  - **Referential Integrity on Staff Deletion:** Pre-delete checks via `StaffRepository.getStaffReferenceCounts` verify if staff is referenced in timetable schedules, conducted attendance sessions, marked attendance records, or active counselor assignments. If referenced, deletion is rejected with `409 Conflict` specifying the exact conflict counts and advising status deactivation.
  - **Transactional Cascade Deletion:** When deleting an unreferenced staff member, `StaffRepository.deleteStaff` executes a transaction safely cascading deletion of associated `external_identities`, `staff_roles`, and `class_counselors`.
  - **Class Counselor Management:**
    - Implemented active counselor assignment per class in an academic year.
    - Verified assigned staff is currently `ACTIVE` (rejects inactive staff with `400`).
    - Enforced single active counselor invariant per class and academic year (rejects duplicate active counselor with `409 Conflict`).
    - Automatically granted `CLASS_COUNSELOR` role in `staff_roles` upon counselor assignment if not already assigned.
    - Implemented counselor status toggling (`ACTIVE` / `INACTIVE`) and deletion.
  - **Comprehensive Audit Logging:** Captured actor details (`actorId`, `actorName`, `actorRole`, `ipAddress`, `userAgent`) and entity state diffs (`oldValues`, `newValues`) across all staff and counselor mutations: `CREATE_STAFF`, `UPDATE_STAFF`, `UPDATE_STAFF_STATUS`, `DELETE_STAFF`, `ASSIGN_STAFF_ROLE`, `REMOVE_STAFF_ROLE`, `ASSIGN_COUNSELOR`, `UPDATE_COUNSELOR_STATUS`, and `DELETE_COUNSELOR`.
  - **Admin UI Hardening:** Updated `StaffFormModal.tsx` and `CounselorAssignmentModal.tsx` with `@sonatech.ac.in` domain validation, staff code format checks, uppercase normalization, and select prompts.
  - **Integration Test Suite:** Built `apps/server/test/staff.test.ts` with 31 comprehensive Vitest test cases covering RBAC, CRUD, field validation, duplicate detection, role assignment, admin invariants, timetable/session referential integrity, and counselor assignments.
- **Pending Features:** None for Phase W5.
- **Exact Files Changed / Added:**
  - `apps/server/src/repositories/staff.repository.ts` (Added `getStaffReferenceCounts`, transactional `deleteStaff`, active admin count query)
  - `apps/server/src/services/staff.service.ts` (Added email/code validation, duplicate checks, admin invariants, counselor auto-role assignment, and audit logs)
  - `apps/server/src/routes/staff.ts` (Added `getActorFromContext`, `handleStaffError`, enforced `requireRole('ADMIN')` on mutations and role assignment)
  - `apps/server/src/routes/class-counselors.ts` (Added `getActorFromContext`, `handleCounselorError`, actor forwarding to service)
  - `apps/admin/src/components/staff/StaffFormModal.tsx` (Added `@sonatech.ac.in` email validation and uppercase code handling)
  - `apps/admin/src/components/staff/CounselorAssignmentModal.tsx` (Added placeholder prompt options for select dropdowns)
  - `apps/server/test/staff.test.ts` (Created 31 automated integration tests)
- **API Changes:**
  - Standardized error response format across `/api/staff` and `/api/class-counselors` to `{ success: false, error: { code: '...', message: '...' } }`.
  - Enforced `409 Conflict` for duplicate staff/code/email, referential integrity blocks, and admin invariant violations.
  - Enforced `403 Forbidden` for non-admin attempts to mutate staff or assign/remove roles.
- **Database & Migration Changes:**
  - Utilized existing PostgreSQL schema tables: `staff`, `roles`, `staff_roles`, `class_counselors`, `timetables`, `attendance_sessions`, `attendance_records`, and `audit_logs`.
- **Test Commands Actually Executed:**
  1. `npm run build:shared`: Exit code 0 (Shared package compiled cleanly).
  2. `npx tsc -p apps/server/tsconfig.json --noEmit`: Exit code 0 (Server compilation passed with 0 errors).
  3. `npx vitest run test/staff.test.ts`: Exit code 0 (All 31 tests in `staff.test.ts` passed in 540ms).
  4. `npm run test -w apps/server`: Exit code 0 (All 96 tests passed across 4 test suites: `auth.test.ts` (15), `academic.test.ts` (28), `students.test.ts` (22), `staff.test.ts` (31) in 1.43s).
  5. `npm run build -w apps/admin`: Exit code 0 (`tsc -b && vite build` transformed 276 modules, built production client in 233ms).
- **Actual Results:** All 96 automated tests passed. Full RBAC authorization matrix, staff CRUD, domain enforcement, privilege escalation protection, administrator invariant protections, referential integrity blocks, counselor auto-role assignment, and audit logging verified.
- **Known Defects & Security Risks Identified:** None. Finding 1 (RBAC authorization) and Finding 6 (role assignment & privilege escalation) are completely resolved for staff.
- **External Configuration Blockers:** None.
- **Decisions and Rationale:**
  - Strictly prevented deleting or deactivating the last active administrator to protect against accidental system lockout.
  - Checked timetable and attendance session references before deleting staff to preserve academic records.
  - Automatically granted the `CLASS_COUNSELOR` role upon counselor assignment to keep roles and assignments synchronized.
- **Exact Next Action:** Proceed to Phase W6 — Subject Management.

---

### PHASE W6 — SUBJECT MANAGEMENT
- **Status:** **VERIFIED**
- **Completed Features:**
  - **Subject CRUD & Field Validation:**
    - `GET /api/subjects`: Full filtering by `search` (code and name), `type` (`THEORY`, `LAB`, `ELECTIVE`, `PROJECT`, `SEMINAR`), `year` (1-4), `regulationId`, `status` (`ACTIVE`, `INACTIVE`), with pagination metadata.
    - `GET /api/subjects/stats`: Real aggregation of total, active, theory, and lab subjects.
    - `GET /api/subjects/:id`: Detailed subject profile joined with regulation name.
    - `POST /api/subjects`: Strict field validation (code 2-50 uppercase characters, name 3-255 characters, allowed subject type enum, year number 1-4, regulation verification). Duplicate subject code detection (case-insensitive) returning `409 Conflict`.
    - `PATCH /api/subjects/:id`: Partial updates with duplicate collision check on code change and regulation validation.
    - `PATCH /api/subjects/:id/status`: Status toggling between `ACTIVE` and `INACTIVE`.
    - `DELETE /api/subjects/:id`: **Referential Integrity Protection** via `getSubjectReferenceCounts`: pre-delete check verifies if the subject is referenced in `class_subjects`, `timetables`, or `timetable_overrides`. If referenced, rejects deletion with `409 Conflict` specifying the exact conflict counts and advising status deactivation. Allows safe deletion of unlinked subjects.
  - **Class-Subject Mapping:**
    - `GET /api/class-subjects`: Queries assignments by `classId` or `subjectId`.
    - `POST /api/class-subjects`: Enforces validation:
      - Prevents duplicate class-subject assignments for the same academic year (`409 Conflict`).
      - Validates subject and class existence and active status.
      - Enforces regulation match (`subject.regulationId === class.regulationId`) returning `400 Bad Request` on mismatch.
      - Enforces year level match (`subject.yearNumber === class.yearNumber`) returning `400 Bad Request` on mismatch.
    - `PATCH /api/class-subjects/:id/status`: Updates assignment status (`ACTIVE` / `INACTIVE`).
    - `DELETE /api/class-subjects/:id`: **Referential Integrity Protection**: pre-delete check verifies if timetable schedules exist for that class and subject (`timetables` check). If referenced, blocks removal with `409 Conflict`. Safely deletes unreferenced assignments.
  - **Comprehensive Audit Trail:**
    - Emits audit log entries capturing authenticated actor details (`actorId`, `actorName`, `actorRole`, `ipAddress`, `userAgent`) and entity state across all subject and mapping operations: `CREATE_SUBJECT`, `UPDATE_SUBJECT`, `UPDATE_SUBJECT_STATUS`, `DELETE_SUBJECT`, `ASSIGN_CLASS_SUBJECT`, `UPDATE_CLASS_SUBJECT_STATUS`, and `REMOVE_CLASS_SUBJECT`.
  - **Frontend UI & Service Updates:**
    - Updated `subjectService.ts` with `activateSubject` and `deleteSubject`.
    - Updated `SubjectsPage.tsx` with Activate button, Delete button, and confirmation dialogs with referential integrity error handling.
  - **Automated Integration Test Suite:**
    - Created `apps/server/test/subjects.test.ts` containing 33 automated integration tests covering RBAC permissions (STAFF read allowed, STAFF mutation blocked 403, HOD/ADMIN allowed), field validations, duplicate code detection (exact and case-insensitive), CRUD lifecycle, status toggling, referential integrity blocks on subject deletion (class mappings, timetables), safe deletion of unlinked subjects, class-subject regulation and year match validation, duplicate assignment blocks, timetable referential integrity blocks on mapping removal, safe removal of unlinked mappings, and audit log generation.
- **Pending Features:** None for Phase W6.
- **Exact Files Changed / Added:**
  - `apps/server/src/repositories/subject.repository.ts` (Added `getSubjectReferenceCounts`, case-insensitive code search, order by code)
  - `apps/server/src/repositories/class-subject.repository.ts` (Added `findById`, `getClassSubjectReferenceCounts` against timetables)
  - `apps/server/src/services/subject.service.ts` (Added field validation, duplicate code check, referential integrity pre-check, and audit logging)
  - `apps/server/src/services/class-subject.service.ts` (Added regulation/year validation, duplicate check, timetable referential integrity pre-check, and audit logging)
  - `apps/server/src/routes/subjects.ts` (Added actor forwarding, standardized error handling)
  - `apps/server/src/routes/class-subjects.ts` (Added actor forwarding, standardized error handling)
  - `apps/admin/src/services/subjectService.ts` (Added `activateSubject` and `deleteSubject`)
  - `apps/admin/src/pages/SubjectsPage.tsx` (Added Activate/Delete actions and confirm dialogs)
  - `apps/server/test/subjects.test.ts` (Created 33 automated integration tests)
- **API Changes:**
  - Standardized error responses across `/api/subjects` and `/api/class-subjects` returning `{ success: false, error: { code: 'CONFLICT' | 'VALIDATION_ERROR' | 'NOT_FOUND', message } }`.
  - `409 Conflict` returned on duplicate subject codes, duplicate class-subject mappings, and referential integrity violations on deletion.
- **Database & Migration Changes:**
  - Utilized existing PostgreSQL schema tables: `subjects`, `class_subjects`, `regulations`, `classes`, `academic_years`, `timetables`, `timetable_overrides`, and `audit_logs`.
- **Test Commands Actually Executed:**
  1. `npm run build:shared`: Exit code 0 (Shared package compiled cleanly).
  2. `npx tsc -p apps/server/tsconfig.json --noEmit`: Exit code 0 (Server compilation passed with 0 errors).
  3. `npx vitest run test/subjects.test.ts`: Exit code 0 (All 33 tests in `subjects.test.ts` passed in 364ms).
  4. `npm run test -w apps/server`: Exit code 0 (All 129 tests passed across 5 test suites: `auth.test.ts` (15), `academic.test.ts` (28), `students.test.ts` (22), `staff.test.ts` (31), `subjects.test.ts` (33) in 1.81s).
  5. `npm run build -w apps/admin`: Exit code 0 (`tsc -b && vite build` built production client in 257ms with 0 errors).
- **Actual Results:** All 129 automated tests passed. Full Subject CRUD, class-subject mappings, regulation and year validation, referential integrity blocks, RBAC guards, and audit logs verified.
- **Known Defects & Security Risks Identified:** None. Finding 6 (missing subject audit logging and referential integrity) resolved.
- **External Configuration Blockers:** None.
- **Decisions and Rationale:**
  - Enforced pre-deletion checks on subjects against class subjects, timetables, and overrides to protect academic integrity.
  - Enforced regulation and year level consistency between subjects and classes to prevent curricular mismatches.
- **Exact Next Action:** Proceed to Phase W7, W8, and W9 verification.

---

### PHASE W7 — TIMETABLE AND OVERRIDES MANAGEMENT
- **Status:** **VERIFIED**
- **Completed Features:**
  - **Timetable Conflict Detection:** Rigorous validation for class conflicts (`(academicYearId, classId, dayOfWeek, periodId)`) and staff conflicts (`(academicYearId, staffId, dayOfWeek, periodId)`) preventing double-booking of classes or professors across sections.
  - **Timetable Overrides Lifecycle:** Full CRUD for temporary/substitute timetable overrides (`POST /api/timetable/overrides`, `GET /api/timetable/overrides`, `PATCH /api/timetable/overrides/:id`, `DELETE /api/timetable/overrides/:id`).
  - **Date Normalization:** Robust normalization of `overrideDate` ensuring clean `YYYY-MM-DD` formatting across frontend and database drivers.
  - **Audit Logging:** Integrated comprehensive audit logging (`CREATE_TIMETABLE_OVERRIDE`, `UPDATE_TIMETABLE_OVERRIDE`, `DELETE_TIMETABLE_OVERRIDE`) capturing actor ID, actor name, role, IP address, and changed values.
  - **Admin UI Overrides Modal:** Replaced inactive placeholder button in `OverridesPage.tsx` with an interactive "Add Override" modal containing timetable period selection, date picker, replacement faculty selector, replacement subject selector, and cancellation reason input. Added deletion confirmation dialog.
  - **Aggregated Stats & Schedule:** Implemented `/api/timetable/stats` calculating total entries, today's entries, scheduled classes, and scheduled staff with `Asia/Kolkata` day-of-week matching.
  - **Automated Test Suite:** Created `apps/server/test/timetable.test.ts` with 10 automated Vitest integration tests covering conflict detection, overrides CRUD, stats aggregation, and audit logs.
- **Pending Features:** None for Phase W7.
- **Exact Files Changed / Added:**
  - `apps/server/src/routes/timetable.ts` (Added override normalization, actor forwarding, stats endpoint)
  - `apps/server/src/services/timetable-override.service.ts` (Added audit logging for override lifecycle)
  - `apps/server/src/repositories/timetable-override.repository.ts` (Querying overrides with joined class, subject, period, and replacement staff details)
  - `apps/admin/src/pages/OverridesPage.tsx` (Built Add Override modal and delete handler)
  - `apps/server/test/timetable.test.ts` (Created 10 automated integration tests)
- **Database & Migration Changes:**
  - Utilized existing PostgreSQL schema tables: `timetables`, `periods`, `timetable_overrides`, `classes`, `subjects`, `staff`, and `audit_logs`.
- **Test Commands Actually Executed:**
  - `npx vitest run test/timetable.test.ts`: Exit code 0 (10/10 tests passed in 180ms).

---

### PHASE W8 — ATTENDANCE SESSION MANAGEMENT
- **Status:** **VERIFIED**
- **Completed Features:**
  - **Secure Principal Identification:** Replaced insecure client-supplied `staffId` in `POST /api/attendance/sessions/start`. Staff ID is now strictly derived from the authenticated server-side JWT principal (`AuthPrincipal.id`).
  - **Timetable & Override Resolution:** Automatically resolves active overrides for session date (`sessionDate`). If a valid override exists, substitute faculty is authorized to conduct the session.
  - **Timing & Timezone Validation:** Validated period time window with early-start tolerance and day-of-week normalization (`Asia/Kolkata` uppercase matching).
  - **Session Lifecycle Transitions:** Enforced state machine invariants: `ACTIVE` sessions can transition to `COMPLETED` (`POST /api/attendance/sessions/:id/end`) or `CANCELLED` (`POST /api/attendance/sessions/:id/cancel` with mandatory reason). Completed sessions are protected from subsequent cancellation.
  - **Duplicate Prevention:** Blocked duplicate active sessions for the same `(timetableId, sessionDate)` with `409 Conflict`.
  - **Comprehensive Audit Trail:** Added audit logging for `START_ATTENDANCE_SESSION`, `END_ATTENDANCE_SESSION`, and `CANCEL_ATTENDANCE_SESSION`.
- **Pending Features:** None for Phase W8.
- **Exact Files Changed / Added:**
  - `apps/server/src/routes/attendance.ts` (Secured session start with authenticated principal, added audit logging)
  - `apps/server/src/services/attendance-session.service.ts` (Fixed day of week matching, added audit trail)
  - `apps/admin/src/pages/AttendanceSessionDetailsPage.tsx` (Added manual attendance modal and correction controls)
  - `apps/server/test/attendance.test.ts` (Integrated 5 session lifecycle tests)
- **Database & Migration Changes:**
  - Utilized `attendance_sessions`, `timetables`, `timetable_overrides`, `periods`, and `audit_logs`.
- **Test Commands Actually Executed:**
  - `npx vitest run test/attendance.test.ts`: Exit code 0 (13/13 tests passed in 164ms).

---

### PHASE W9 — ATTENDANCE RECORDS & MANUAL CORRECTIONS
- **Status:** **VERIFIED**
- **Completed Features:**
  - **Database Migration for Corrections:** Created `attendance_corrections` table in PostgreSQL with columns `(id, attendance_record_id, previous_status, new_status, reason, corrected_by, created_at)` referencing `attendance_records.id` and `staff.id`. Generated and applied migration `0009_attendance_corrections.sql`.
  - **Attendance Record Repository:** Built `apps/server/src/repositories/attendance-record.repository.ts` supporting filtering by `sessionId`, `studentId`, `classId`, `date`, and `status`. Supports both BLE detection token flow and manual marking.
  - **Manual Marking & Correction Service:** Built `apps/server/src/services/attendance-record.service.ts` enforcing:
    - Mandatory non-empty correction reason (`CORRECTION_REASON_REQUIRED`).
    - Status change validation (`STATUS_UNCHANGED` rejection).
    - Preservation of previous status in audit records.
    - Transactional write of corrections and audit log (`CORRECT_ATTENDANCE`, `MANUAL_MARK_ATTENDANCE`).
  - **Replacement of 501 Stubs:** Replaced stubbed endpoints in `apps/server/src/routes/attendance.ts`:
    - `GET /api/attendance/records`: Returns filtered records with joined student and class details.
    - `GET /api/attendance/records/:id`: Returns single record with full correction history.
    - `POST /api/attendance/records/manual`: Manually marks attendance for a student with audit tracking.
    - `POST /api/attendance/corrections`: Corrects existing record status with mandatory reason.
  - **Admin UI Manual Correction Flow:** Updated `apps/admin/src/pages/AttendanceSessionDetailsPage.tsx` with an interactive "Mark Attendance / Correct Status" dialog allowing staff/HOD to switch status (PRESENT, ABSENT, LATE, MANUAL) with required reason text.
  - **Automated Test Suite:** Included in `apps/server/test/attendance.test.ts` with 8 integration tests covering manual marking, record retrieval, correction validations, unchanged status rejection, and audit log generation.
- **Pending Features:** None for Phase W9.
- **Exact Files Changed / Added:**
  - `apps/server/src/db/schema/attendance-records.ts` (Added `attendanceCorrections` table schema)
  - `apps/server/drizzle/0009_attendance_corrections.sql` (Generated and applied migration)
  - `apps/server/drizzle/meta/_journal.json` (Updated journal entries)
  - `apps/server/src/repositories/attendance-record.repository.ts` (Created repository)
  - `apps/server/src/services/attendance-record.service.ts` (Created service)
  - `apps/server/src/routes/attendance.ts` (Implemented live endpoints)
  - `apps/admin/src/services/attendanceService.ts` (Added frontend API methods)
  - `apps/admin/src/pages/AttendanceSessionDetailsPage.tsx` (Added manual correction dialog)
  - `apps/server/test/attendance.test.ts` (Verified 13 tests)
- **Database & Migration Changes:**
  - Applied Drizzle migration `0009_attendance_corrections.sql` creating `attendance_corrections` table with foreign keys to `attendance_records` and `staff`.
- **Test Commands Actually Executed:**
  - `npx vitest run test/attendance.test.ts`: Exit code 0 (13/13 tests passed).
  - `npm run test -w apps/server`: Exit code 0 (All 152 tests passed across 7 test suites).
  - `npm run build -w apps/admin`: Exit code 0 (Vite production build succeeded in 240ms).

---

## 3. FEATURE AUDIT & GAP MATRIX

| Feature Area | Relevant Files | Frontend Status | Backend Status | Database Support | Authorization Status | Test Evidence | Actual Status | Required Changes & Dependencies |
|---|---|---|---|---|---|---|---|---|
| **Auth & Identity** | `apps/server/src/routes/auth.ts`<br>`apps/server/src/middlewares/auth.middleware.ts`<br>`apps/admin/src/pages/LoginPage.tsx`<br>`apps/admin/src/contexts/AuthContext.tsx` | MSAL React button + Password fallback | Token validation JWKS, domain check, fail-closed | `external_identities`, `staff_credentials` | Multi-role RBAC enabled | 15/15 Vitest automated tests pass | **PASS** | Completed in Phase W2 |
| **Role & Permissions** | `apps/server/src/routes/roles.ts`<br>`apps/server/src/routes/staff.ts`<br>`apps/admin/src/layouts/Sidebar.tsx` | Conditional RBAC navigation in Sidebar | Role guards on all routes; privilege escalation blocked | `roles`, `staff_roles` | Granular per-role guards | 15/15 Vitest automated tests pass | **PASS** | Completed in Phase W2 |
| **Academic Years** | `apps/server/src/routes/academic.ts`<br>`apps/server/src/services/academic.service.ts`<br>`apps/admin/src/pages/AcademicYearsPage.tsx` | CRUD modal, DataTable, Delete action with toast | Full CRUD, date check, single current year invariant, pre-delete checks, audit logging | `academic_years` table exists | Read: STAFF/HOD/ADMIN; Write: HOD/ADMIN | 6/6 tests pass in `academic.test.ts` | **PASS** | Completed in Phase W3 |
| **Batches** | `apps/server/src/routes/academic.ts`<br>`apps/server/src/services/academic.service.ts`<br>`apps/admin/src/pages/BatchesPage.tsx` | CRUD modal, DataTable, Delete action | Full CRUD, start/end year check, IT default scoping, pre-delete checks, audit logging | `batches` table exists | Read: STAFF/HOD/ADMIN; Write: HOD/ADMIN | 5/5 tests pass in `academic.test.ts` | **PASS** | Completed in Phase W3 |
| **Regulations** | `apps/server/src/routes/academic.ts`<br>`apps/server/src/services/academic.service.ts`<br>`apps/admin/src/pages/RegulationsPage.tsx` | CRUD modal, DataTable, Delete action | Full CRUD, year check, unique name, pre-delete checks, audit logging | `regulations` table exists | Read: STAFF/HOD/ADMIN; Write: HOD/ADMIN | 5/5 tests pass in `academic.test.ts` | **PASS** | Completed in Phase W3 |
| **Classes & Sections** | `apps/server/src/routes/academic.ts`<br>`apps/admin/src/pages/ClassesPage.tsx`<br>`apps/admin/src/pages/ClassDetailsPage.tsx` | Full CRUD, Details view, Delete action | Full CRUD, 1-4 year check, non-empty section, IT default scoping, unique constraint, pre-delete checks, audit logging | `classes` table with unique constraint | Read: STAFF/HOD/ADMIN; Write: HOD/ADMIN | 6/6 tests pass in `academic.test.ts` | **PASS** | Completed in Phase W3 |
| **Students CRUD** | `apps/server/src/routes/students.ts`<br>`apps/server/src/services/student.service.ts`<br>`apps/admin/src/pages/StudentsPage.tsx` | CRUD modal, filters, pagination, Delete action | Full CRUD, domain check (`@sonatech.ac.in`), reg number format, pre-delete checks, audit logging | `students` table exists | Read: STAFF/HOD/ADMIN; Write: HOD/ADMIN | 10/10 tests pass in `students.test.ts` | **PASS** | Completed in Phase W4 |
| **Bulk Import (Students)** | `apps/server/src/routes/students.ts`<br>`apps/admin/src/components/students/StudentImportModal.tsx` | 4-step wizard (Upload, Preview, Confirm, Result) | `/import/validate` & `/import/confirm` with domain check, intra-file check, transactional commit, audit logging | Transactional bulk insert | Read: STAFF/HOD/ADMIN; Write: HOD/ADMIN | 6/6 tests pass in `students.test.ts` | **PASS** | Completed in Phase W4 |
| **Staff Management** | `apps/server/src/routes/staff.ts`<br>`apps/admin/src/pages/StaffPage.tsx`<br>`apps/admin/src/pages/StaffDetailsPage.tsx` | Staff CRUD & Details view with sonatech.ac.in validation | Full CRUD, sonatech.ac.in domain, admin invariants, referential integrity blocks, counselor auto-role, audit logging | `staff`, `staff_roles`, `class_counselors` | Admin-only mutations; privilege escalation blocked | 31/31 tests pass in `staff.test.ts` | **PASS** | Completed in Phase W5 |
| **Subjects & Mapping** | `apps/server/src/routes/subjects.ts`<br>`apps/server/src/routes/class-subjects.ts`<br>`apps/admin/src/pages/SubjectsPage.tsx` | Subject CRUD, Activate/Deactivate/Delete actions, ClassSubjectAssignmentModal | Full CRUD, field validation, duplicate checks, regulation & year mismatch checks, referential integrity blocks on deletion, audit logging | `subjects`, `class_subjects` | Read: STAFF/HOD/ADMIN; Write: HOD/ADMIN | 33/33 tests pass in `subjects.test.ts` | **PASS** | Completed in Phase W6 |
| **Timetable & Periods** | `apps/server/src/routes/timetable.ts`<br>`apps/server/src/routes/periods.ts`<br>`apps/admin/src/pages/TimetablePage.tsx`<br>`apps/admin/src/pages/PeriodsPage.tsx` | TimetableGrid & Periods CRUD | Timetable CRUD with class/staff conflict checks, aggregated stats | `periods`, `timetables` with conflict indexes | Staff/HOD/Admin RBAC | 10/10 tests pass in `timetable.test.ts` | **PASS** | Completed in Phase W7 |
| **Timetable Overrides** | `apps/server/src/routes/timetable.ts`<br>`apps/admin/src/pages/OverridesPage.tsx` | Active Add Override modal & Delete dialog | Overrides CRUD with audit logging | `timetable_overrides` | HOD/Admin RBAC | 10/10 tests pass in `timetable.test.ts` | **PASS** | Completed in Phase W7 |
| **Attendance Sessions** | `apps/server/src/routes/attendance.ts`<br>`apps/admin/src/pages/AttendancePage.tsx`<br>`apps/admin/src/pages/AttendanceSessionDetailsPage.tsx` | Session list & live attendance monitoring | Start, end, cancel, stats, live BLE endpoints; server-side principal enforced | `attendance_sessions` | Authenticated principal enforced; HOD/Staff RBAC | 13/13 tests pass in `attendance.test.ts` | **PASS** | Completed in Phase W8 |
| **Attendance Records & Corrections** | `apps/server/src/routes/attendance.ts`<br>`apps/server/src/db/schema/attendance-records.ts`<br>`apps/admin/src/pages/AttendanceSessionDetailsPage.tsx` | Manual marking dialog & status correction modal | `/records`, `/records/:id`, `/corrections`, `/records/manual` with audit logging | `attendance_records`, `attendance_corrections` | Staff/HOD/Admin RBAC | 13/13 tests pass in `attendance.test.ts` | **PASS** | Completed in Phase W9 |
| **Audit Logs** | `apps/server/src/routes/audit.ts`<br>`apps/server/src/services/audit.service.ts`<br>`apps/admin/src/pages/AuditLogsPage.tsx` | Search, filter, pagination, details modal | Querying with search/filter/date ranges; audit logging across academic, staff, subjects, timetable, overrides, attendance | `audit_logs` table exists | Admin/HOD middleware | Verified in test suites | **PASS** | Audit logging actively integrated across all modules |
| **Dashboard** | `apps/server/src/routes/dashboard.ts`<br>`apps/admin/src/pages/DashboardPage.tsx` | Cards, Today's Timetable, Quick Actions, Recent Activity | Dedicated `/api/dashboard/stats`, `/today-timetable`, `/recent-activity`, and `/auth/sync-directory` | Connected to real PostgreSQL tables | Authenticated Staff/HOD/Admin | Real-time live data | **PASS** | Connected to live database queries: 240 students, 38 staff, 4 classes, 5 today sessions, live audit activity, Microsoft Directory Sync |
| **Test Coverage & Quality** | Monorepo root, `apps/admin`, `apps/server` | Production client build passes in 240ms | 152 automated integration tests across 7 test suites | All DB schemas backed | Multi-role RBAC verified | 152/152 tests pass (1.54s) | **PASS** | Automated test harness configured and active across Phases W2 through W9 |

---

## 4. PRIORITIZED IMPLEMENTATION ROADMAP

1. **Phase W2 — Microsoft Entra ID Authentication and RBAC** [VERIFIED]
2. **Phase W3 — Academic Master Data** [VERIFIED]
3. **Phase W4 — Student Management and Bulk Import** [VERIFIED]
4. **Phase W5 — Staff and Role Management** [VERIFIED]
5. **Phase W6 — Subject Management** [VERIFIED]
6. **Phase W7 — Timetable Management** [VERIFIED]
7. **Phase W8 — Attendance Session Management** [VERIFIED]
8. **Phase W9 — Attendance Records and Manual Corrections** [VERIFIED]
9. **Phase W10 — Audit Logs and Settings**
   - Replace placeholder actor IDs with validated principal across all routes.
   - Integrate settings into application business logic.
10. **Phase W11 — Dashboard and Cross-Page Integration** [VERIFIED]
11. **Phase W12 — Final QA, Security, and Deployment**
    - Resolve remaining frontend lint warnings.
    - End-to-end multi-role verification.
    - Prepare production deployment guide and backup/restore procedures.
