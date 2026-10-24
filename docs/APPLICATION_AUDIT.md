# Application audit and access/data-flow notes

This inventory reflects the active admin router and server route registrations. It describes the current implementation, not a claim that every workflow has been exercised end to end.

## Active admin pages

| Page | Data/API source | Data and access notes |
|---|---|---|
| Dashboard | `/api/dashboard/*` | Counts active classes, students, staff, subjects, current-date timetable entries and attendance sessions from the database. Recent activity comes from audit rows. Invalid or failed responses are shown as errors rather than replaced by sample values. |
| Academic Years | `/api/academic-years` | Reads and writes persisted academic-year records; shared-module authorization applies. |
| Batches | `/api/batches` | Reads and writes persisted batches; shared-module authorization applies. |
| Regulations | `/api/regulations` | Reads and writes persisted regulations; shared-module authorization applies. |
| Classes | `/api/classes` | Reads and writes persisted classes and their academic references; shared-module authorization applies. The legacy `/classes/:id` route redirects to the list. |
| Students | `/api/students` | Uses persisted student rows, filters, pagination, status updates, and validated create-only imports. Template and preview/confirm endpoints are shared. |
| Faculty / Staff | `/api/staff` | Uses persisted staff rows, detail/timetable/assignment views, status updates, and validated create-only imports. Template and preview/confirm endpoints are shared. Faculty record management does not create login credentials or teaching assignments. |
| Counselors | `/api/class-counselors` | Uses persisted counselor/class assignments; shared-module authorization applies. |
| Subjects | `/api/subjects`, `/api/class-subjects` | Uses persisted subjects and class assignments; shared-module authorization applies. |
| Subject details | `/api/subjects`, `/api/class-subjects` | Displays persisted subject/class assignment data. |
| Timetable | `/api/timetable`, `/api/periods` | Reads and writes persisted timetable data; shared-module authorization applies. Period configuration writes remain ADMIN-only. |
| Timetable overrides | `/api/timetable/overrides` | Uses persisted override data and shared-module authorization. The former unused placeholder page has been removed. |
| Periods | `/api/periods` | Reads persisted periods. Period create/update/delete APIs remain ADMIN-only. |
| Staff timetable | `/api/staff/:id/timetable`, `/api/periods` | Reads a staff member's persisted timetable. |
| Attendance | `/api/attendance/*` | Session, record, and statistic views use persisted attendance/timetable data. Mutation APIs require a linked staff identity; standalone public FACULTY accounts receive an explicit `STAFF_PROFILE_REQUIRED` response. |
| Attendance session details | `/api/attendance/*` | Reads persisted session and attendance records; staff-linked identity is required for attendance changes. |
| Audit Logs | `/api/audit/logs` | Persisted audit events; ADMIN, HOD, and DEPUTY_HOD only. |
| Settings | `/api/settings`, `/api/periods` | Reads persisted settings; settings writes and period configuration writes remain ADMIN-only. The page is restricted to ADMIN in the client route as well. |

The shared application route is protected by server-derived roles. HOD and FACULTY use the same core academic, people, subject, timetable, and attendance views. Audit Logs are additionally available to department leadership; Settings and privileged period configuration are intentionally not public-FACULTY features.

## Data integrity and authorization observations

- Dashboard totals are database counts, not page constants. They count rows with `ACTIVE` status. Scheduled-today values additionally filter active timetable entries, periods, and the active/current academic year.
- Server and admin attendance date defaults use `Asia/Kolkata`; timetable weekday calculation uses the same application timezone.
- Student and staff templates describe the actual import columns. Preview validates without creating records; confirmation revalidates on the server and creates new records only.
- Public sign-up creates a FACULTY authentication account only. It cannot assign ADMIN/HOD or create a corresponding staff row. Attendance changes therefore require a separately provisioned, valid staff identity and timetable assignment.
- Audit actor IDs for standalone FACULTY accounts are omitted where the database foreign key points to `staff.id`; actor name and role remain available in the audit event.
- The Entra directory-feed implementation is not mounted. Historical identity schemas/migrations remain untouched. The backend still verifies application-issued bearer JWTs against mapped identity rows. Direct Microsoft access-token validation and identity-resolution methods have no current route callers. The student login endpoint is development-only, and the professor app reports Entra sign-in as unconfigured; no production mobile sign-in flow is claimed or validated here.

## Current configured database inspection (2026-10-20)

Counts were queried from the configured local PostgreSQL database without reading or printing names, email addresses, or record IDs:

| Table | Total | Active/current |
|---|---:|---:|
| Students | 243 | 243 |
| Staff | 87 | 87 |
| Classes | 4 | 4 |
| Subjects | 8 | 8 |
| Timetables | 21 | 21 |
| Attendance sessions | 3 | 0 active (all 3 are completed) |
| Attendance records | 2 | 2 persisted (both are ABSENT records) |
| Audit logs | 134 | 134 |

The historical seed script in commit `ccab2ab` explicitly contains 38 synthetic student register numbers. All 38 match current student rows; none has attendance records, BLE devices, or BLE tokens, while all 38 have legacy external-identity mappings. The same script contains 11 staff codes that match current rows; all 11 have credentials, 4 have timetable references, and 2 carry leadership roles. Those historical rows are strong evidence of seeded demo data, but their login and relational impact means this audit did not deactivate or delete them.

Audit history also records one successful student CSV/XLSX import of 2 records and one manual student creation. These records must not be mistaken for auto-generated samples. The remaining 202 students and 76 staff do not match the known static records in that historical seed script; their provenance is not established by current row-level source fields. All 255 external identity links are marked `LEGACY_UNVERIFIED`; two recorded directory sync attempts failed before scanning users. Subject data is likewise marked `LEGACY_UNVERIFIED`. No records were deleted or status-changed during this audit: historical attendance/audit data and unverified user records are preserved. A clean count of zero cannot be claimed for this configured database.

## Initialization and live attendance boundary

- Application startup only mounts routes and starts the HTTP server. It does not insert student, staff, class, subject, timetable, or attendance rows. The database setup script only creates a missing local PostgreSQL database. Seed-named scripts that could create synthetic student/academic data are disabled; the staff-named seed script only inserts role definitions and is not invoked by startup.
- The admin client has no React Query cache or local/session storage data source, and no mock student/staff arrays were found in active source.
- Attendance persists session status transitions and student records through PostgreSQL. The admin dashboard and attendance views now poll persisted data and report refresh failures rather than silently treating a failed request as zero.
- BLE tokens are random, stored hashed, session-bound, and expire after two hours. The backend validates token/session/student/class relationships before persisting BLE attendance. The current BLE start endpoint returns plaintext tokens to the authenticated caller and no real BLE scanner transport or device attestation was verified in this audit. BLE-to-record end-to-end behavior and human identity verification are not claimed.
- `GET /api/timetable` now rejects requests without exactly one of `classId` or `staffId`, rather than returning a successful empty array for an underspecified request.

## Validation and limitations

- The admin production TypeScript/Vite build passed after these changes.
- Server TypeScript no-emit checks passed with the server-local TypeScript compiler.
- Focused database-independent tests passed: date, directory classification, and tabular import (3 files, 8 tests).
- Focused ESLint across the touched admin pages is not clean: it reports `any` type violations and React Hooks effect-rule findings in these pages. No unrelated lint cleanup was included.
- Database-backed auth integration tests require a loopback PostgreSQL database named with the `_test` suffix. The configured development database does not satisfy that guard, so no live integration result is claimed here.
- The mobile apps and any production Entra token flow have not been end-to-end tested as part of this admin/module-access work. Removing the remaining identity-token and historical schema code requires a separate mobile/identity migration review.
