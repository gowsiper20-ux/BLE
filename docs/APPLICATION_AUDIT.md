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

## Validation and limitations

- Admin production TypeScript/Vite build passed after these changes.
- Server TypeScript no-emit check passed after these changes.
- The timezone helper's focused unit test passed.
- The changed dashboard/route/sidebar files pass targeted ESLint. A wider lint run still reports pre-existing `any` and React-effect findings in other page files; those unrelated findings were not folded into this change.
- Database-backed auth integration tests require a loopback PostgreSQL database named with the `_test` suffix. The configured development database does not satisfy that guard, so no live integration result is claimed here.
- The mobile apps and any production Entra token flow have not been end-to-end tested as part of this admin/module-access work. Removing the remaining identity-token and historical schema code requires a separate mobile/identity migration review.
