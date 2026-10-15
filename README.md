# Smart Attendance System

A production-quality Smart Attendance System for college administration, currently scoped to the **Information Technology (IT) department**.

## Architecture

```
React Admin Dashboard  →  Hono REST API  →  Drizzle ORM  →  PostgreSQL
```

### Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | React, TypeScript, Vite, React Router |
| Backend    | Hono, TypeScript, Node.js           |
| Database   | PostgreSQL                          |
| ORM        | Drizzle ORM + drizzle-kit           |
| Build      | npm workspaces (monorepo)           |

## Project Structure

```
smart-attendance/
├── apps/
│   ├── admin/                    # Admin Dashboard (React + Vite)
│   │   └── ...
│   │
│   ├── server/                   # Hono Backend API
│   │   └── ...
│   │
│   ├── student/                  # Student Mobile App (Expo / React Native)
│   │   ├── app/                  # Expo Router screens
│   │   ├── services/             # API clients
│   │   ├── store/                # AuthContext
│   │   ├── .env                  # Environment variables
│   │   └── package.json
│   │
│   └── professor/                # Professor Mobile App (Expo / React Native)
│       ├── app/                  # Expo Router screens
│       ├── services/             # API clients
│       ├── store/                # AuthContext
│       ├── .env                  # Environment variables
│       └── package.json
│
├── packages/
│   └── shared/                   # Shared TypeScript types and contracts
│
├── package.json                  # Root monorepo config
└── README.md
```

## Development Setup

### Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL 15+ (required for full backend, not needed for frontend-only development)

### Installation

```bash
# Clone and install all dependencies
npm install
```

### Environment Variables

Copy the relevant `.env.example` file to `.env` and replace the placeholders with local values. `.env` files are ignored by Git and must not be committed.

#### Admin Frontend (`apps/admin/.env`)

```env
VITE_API_URL=http://localhost:3000
```

#### Backend Server (`apps/server/.env`)

```env
PORT=3000
DATABASE_URL=postgres://postgres:your_local_password@localhost:5432/smart_attendance
CORS_ORIGIN=http://localhost:5173
```

#### Mobile Apps (`apps/student/.env`, `apps/professor/.env`)

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_DEV_LOGIN_MODE=true
```

> **IMPORTANT:** BLE is NOT implemented in Phase 9. Mobile apps are running as a foundation only.

### Running the Project

#### Both frontend and backend together:

```bash
npm run dev
```

#### Admin Dashboard only:

```bash
npm run dev:admin
# Runs at http://localhost:5173
```

#### Backend only:

```bash
npm run dev:server
# Runs at http://localhost:3000
```

#### Student Mobile App:

```bash
npm run dev:student
```

#### Professor Mobile App:

```bash
npm run dev:professor
```

### Verification

```bash
# TypeScript check (frontend)
cd apps/admin && npx tsc -b --noEmit

# TypeScript check (backend)
cd apps/server && npx tsc --noEmit

# ESLint (frontend)
cd apps/admin && npx eslint .

# Build (frontend)
cd apps/admin && npx vite build
```

## Database Setup

Copy `apps/server/.env.example` to `apps/server/.env` and set your local PostgreSQL password and a unique `JWT_SECRET`. Then set up the database, apply migrations, and create the local admin account:

```bash
npm run db:setup -w apps/server
npm run db:migrate -w apps/server
npm run db:bootstrap-admin -w apps/server
```

For local development, the bootstrap script defaults to `admin@college.edu` / `Admin@123`. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `apps/server/.env` to choose different credentials. Change the default password before exposing the server beyond your local machine.

## Admin Dashboard

### Available Routes

| Route                  | Page               | Status        |
|------------------------|--------------------|---------------|
| `/login`               | Login              | Placeholder   |
| `/dashboard`           | Dashboard Home     | Mock Data     |
| `/academic-years`      | Academic Years     | Placeholder   |
| `/batches`             | Batches            | Placeholder   |
| `/regulations`         | Regulations        | Placeholder   |
| `/classes`             | Classes            | Placeholder   |
| `/students`            | Students           | Placeholder   |
| `/staff`               | Staff              | Placeholder   |
| `/subjects`            | Subjects           | Placeholder   |
| `/timetable`           | Weekly Timetable   | Placeholder   |
| `/timetable/overrides` | Overrides          | Placeholder   |
| `/attendance`          | Attendance         | Placeholder   |
| `/reports`             | Reports            | Placeholder   |
| `/audit-logs`          | Audit Logs         | Placeholder   |
| `/settings`            | Settings           | Placeholder   |

### Reusable Components

- `Button` — Primary, Secondary, Danger, Ghost variants
- `Input` — With label, error, and help text
- `Select` — Dropdown with options
- `Modal` — Dialog overlay with header/body/footer
- `Card` — Content container with padding variants
- `Badge` — Status indicators (success, warning, danger, info)
- `DataTable` — Sortable, paginated data table
- `SearchBar` — Search input with clear button
- `PageHeader` — Title + breadcrumbs + actions
- `Breadcrumb` — Navigation breadcrumbs
- `Toast` — Notification toasts (success, error, warning, info)
- `LoadingSpinner` — Loading indicator
- `EmptyState` — Empty data placeholder
- `ErrorState` — Error display with retry
- `ConfirmDialog` — Confirmation modal

### API Routes (Backend)

| Route                         | Method | Status          |
|-------------------------------|--------|-----------------|
| `GET /`                       | GET    | ✅ Implemented  |
| `POST /api/auth/login`        | POST   | Implemented     |
| `POST /api/auth/logout`       | POST   | Implemented     |
| `GET /api/auth/me`            | GET    | Implemented     |
| `GET /api/academic/years`     | GET    | Stub (501)      |
| `GET /api/academic/batches`   | GET    | Stub (501)      |
| `GET /api/academic/classes`   | GET    | Stub (501)      |
| `GET /api/students`           | GET    | Stub (501)      |
| `POST /api/students/import`   | POST   | Stub (501)      |
| `GET /api/staff`              | GET    | Stub (501)      |
| `GET /api/subjects`           | GET    | Stub (501)      |
| `GET /api/timetable`          | GET    | Stub (501)      |
| `GET /api/attendance/sessions`| GET    | Stub (501)      |
| `GET /api/reports/attendance` | GET    | Stub (501)      |
| `GET /api/audit/logs`         | GET    | Stub (501)      |

## Future Modules

The following will be implemented in subsequent phases:

1. **Academic Management** — Full CRUD for years, batches, regulations, classes
2. **Student Management** — CRUD + CSV/Excel bulk import with validation
3. **Staff Management** — CRUD + role assignment + class counselor designation
4. **Subject Management** — CRUD linked to regulations
5. **Timetable System** — Weekly timetable with conflict detection
6. **Timetable Overrides** — Temporary changes without modifying permanent schedule
7. **Attendance System** — Sessions, records, corrections
8. **Reports & Analytics** — Attendance reports, exports
9. **Audit Logging** — Administrative action tracking
10. **Authentication** — Microsoft OAuth integration
11. **BLE Attendance** — Bluetooth-based attendance detection
12. **Face Recognition** — Face-based attendance verification

## Design System

- **Theme:** Dark professional
- **Primary:** `#121212` | Surface: `#242424` | Border: `#333333`
- **Accent:** `#00FF7F` (neon green) | Secondary: `#FFA500` (orange)
- **Typography:** Inter, system-ui, sans-serif
- **Font sizes:** 12–28px with clear hierarchy

## License

Private — Internal use only.
