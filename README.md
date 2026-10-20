# SONA Smart Attendance

A monorepo for SONA College of Technology's academic attendance system. The administrator web app manages the department's academic records through a React dashboard and a Hono API backed by PostgreSQL and Drizzle.

## Applications

- `apps/admin` — React, Vite, TypeScript administration dashboard.
- `apps/server` — Hono/Node.js API, Drizzle ORM, PostgreSQL.
- `apps/student` — Existing Expo student app.
- `apps/professor` — Existing Expo professor app.
- `packages/shared` — Shared TypeScript contracts.

The admin web app uses local HOD email/password authentication and does not require Microsoft Entra configuration. Historical external-identity tables and data are retained; the admin app does not sign in with Entra or consume directory snapshots.

## Requirements

- Node.js 22 LTS and npm 10 or later.
- PostgreSQL 15 or later.

## Install and configure

From the repository root:

```powershell
npm install
Copy-Item apps/server/.env.example apps/server/.env
Copy-Item apps/admin/.env.example apps/admin/.env
```

Set the local values in `apps/server/.env`:

- `DATABASE_URL` — PostgreSQL connection string.
- `JWT_SECRET` — a random value of at least 32 characters.
- `PORT` and `CORS_ORIGIN` — API port and the admin web origin.
- `COLLEGE_EMAIL_DOMAIN` — comma-separated approved college email domains used for student and faculty record validation.

Generate a JWT secret locally with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Set `VITE_API_URL` in `apps/admin/.env` to the API URL. Never place passwords, JWT secrets, or other credentials in a `VITE_*` variable. Existing ignored `.env` files are local developer configuration and should not be overwritten.

## Database and first HOD account

Apply the forward-only migrations:

```powershell
npm run db:migrate -w apps/server
```

Create the first HOD with the restricted, interactive bootstrap command:

```powershell
npm run db:bootstrap-admin -w apps/server
```

The script prompts for full name, college email, staff code, password, and password confirmation. Password input is hidden. Use a strong password of at least 12 characters. The operation is restricted to a terminal, serialized with a PostgreSQL advisory lock, and refuses to create another local ADMIN/HOD credential once bootstrap is complete. Run the command from a trusted administration machine after migrations have completed.

### Development faculty sign-up

In non-production environments, the login page offers **Don't have an account? Sign up**. Public sign-up creates only a FACULTY authentication account, using the name, email, and password supplied by the user. Sign-up and sign-in open the same existing dashboard used by HOD users. The account remains separate from academic faculty/staff records: registration does not invent a staff code, department, teaching assignment, or timetable.

Public sign-up is forcibly disabled when `NODE_ENV=production`. It never creates HOD or ADMIN accounts, regardless of any role value submitted by a client. Create the first HOD with the restricted bootstrap command above; additional privileged access must be provisioned by an authorized administrator.

Faculty accounts use the shared dashboard, academic, student, faculty/staff, subject, timetable, and attendance read modules. Their server-side access includes student/staff listing and management, reference-data writes, and import preview/confirmation. Audit logs remain limited to ADMIN/HOD/DEPUTY_HOD, while settings and period configuration writes remain ADMIN-only. A public FACULTY account is not linked to an invented staff record, so attendance mutations that require a staff/timetable identity return `STAFF_PROFILE_REQUIRED`; attendance viewing remains available. Faculty accounts are not promoted to staff or given fabricated staff assignments.

Start the backend and admin frontend in separate terminals:

```powershell
npm run dev:server
npm run dev:admin
```

The admin UI is normally available at `http://localhost:5173`. Sign in with the HOD email and password created during bootstrap, or use the non-production faculty sign-up flow. The browser receives a short-lived HTTP-only, SameSite cookie; the API validates the session on each request. Production must use HTTPS and a production-quality `JWT_SECRET`.

## Academic setup and people management

Configure actual academic years, admission batches, regulations, departments, and classes before registering students. Do not create placeholder academic records to bypass a missing prerequisite. Classes require an existing active department, academic year, batch, and regulation; the batch must belong to the selected department.

### Student management

The Students page supports search by register number/name, class and status filters, manual create/edit, and explicit status changes. Students require a register number, full name, college email, and an existing class. Records are deactivated rather than deleted from the management workflow to preserve attendance history.

For bulk import, download the blank template and provide:

```text
register_number,name,college_email,class_id
```

`class_id` must identify an existing active class. Both `.csv` and `.xlsx` are accepted. The preview reports invalid fields, duplicate identifiers/emails, and missing classes. Confirming re-uploads and revalidates the same file on the server. Imports create new records only; concurrent uniqueness conflicts are skipped and included in the result. Student imports do not create student login credentials.

### Faculty/staff management

The Faculty / Staff page supports search by staff identifier/name, status filters, manual create/edit, detail and counselor-assignment views, explicit status changes, and bulk import. The existing staff schema requires:

```text
staff_code,name,college_email
```

Faculty imports also accept `.csv` and `.xlsx`, are validated again on the server when confirmed, create new records only, and do not create login credentials or teaching assignments. Department/designation fields are not present on the current staff schema and are not invented by the form.

## Validation and development checks

```powershell
npm run test -w apps/server
npx tsc --noEmit -p apps/server/tsconfig.json
npm run lint -w apps/admin
npm run build -w apps/admin
```

Server tests require an isolated PostgreSQL database whose name ends in `_test`; they refuse a non-loopback or non-test database when `NODE_ENV=test`.

## Microsoft and mobile status

Admin web login and directory-management screens no longer use MSAL, Entra login, Graph, or the signed directory-feed API. There are no MSAL package dependencies in the web application. The backend's Entra token verifier remains for existing mobile bearer-token compatibility; removing it requires a separate mobile authentication migration. The signed directory-feed source is unmounted and inactive. Existing external-identity and directory-snapshot database tables are retained for historical data; no applied migration is deleted.

The student and professor app source trees were not rewritten. The backend continues to support its application-issued bearer-session verification path, but the current mobile authentication flows are development-stage and should be separately validated before production use.
