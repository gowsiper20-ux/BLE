# Microsoft Entra ID and Graph local setup

This guide covers local configuration for the existing admin SPA and Hono server. It does not assert that the tenant app registration, consent, directory groups, or academic data have been verified.

## Admin SPA

Create `apps/admin/.env` from `apps/admin/.env.example` and verify each value in Entra App registrations:

- `VITE_MSAL_TENANT_ID`: the single tenant ID.
- `VITE_MSAL_CLIENT_ID`: the SPA application ID.
- `VITE_MSAL_API_SCOPE`: the exact delegated scope exposed by the backend API and consented for the SPA, such as `api://<api-app-id>/access_as_user`.
- `VITE_MSAL_REDIRECT_URI`: an exact configured SPA redirect URI, for example `http://localhost:5173/`.
- `VITE_API_URL`: the Hono API URL, normally `http://localhost:3000`.

These `VITE_*` values are public and bundled into the browser. Never put a client secret in the admin environment file.

## Server and Graph

Create `apps/server/.env` from `apps/server/.env.example`. Set the verified tenant and Graph confidential-client application ID, plus a locally stored `MICROSOFT_CLIENT_SECRET`. Do not commit, log, or share the secret.

The current server:

- validates the API access-token signature, tenant (`tid`), audience (`aud`), delegated scope (`scp`), and object ID (`oid`);
- requests Graph client-credential tokens with `https://graph.microsoft.com/.default`;
- enumerates `/users` and configured direct group memberships, following Graph continuation links;
- requires non-empty `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, and `MICROSOFT_CLIENT_SECRET` before reporting Graph as configured.

The current sync calls require suitable Microsoft Graph **application** permissions, including `User.Read.All` and `GroupMember.Read.All`, with tenant administrator consent. See Microsoft's [Graph permissions reference](https://learn.microsoft.com/graph/permissions-reference). The actual configured registration, permissions, and consent must be confirmed by the tenant administrator. The delegated `access_as_user` scope only covers SPA-to-API access and does not grant Graph application permissions.

`MICROSOFT_API_AUDIENCE` must equal the access token's actual `aud`; `MICROSOFT_API_SCOPE` must equal the delegated `scp` value (for example, `access_as_user`). MSAL uses the v2 endpoint, where Microsoft's [access-token claims reference](https://learn.microsoft.com/entra/identity-platform/access-token-claims-reference) documents `aud` as the API application's client-ID GUID, not its `api://` scope URI. The backend also validates a v2 issuer, so confirm the API registration emits v2 tokens and configure the audience to that registration's actual client ID. The local value was changed from the URI form to the GUID corresponding to the configured scope, but tenant metadata and the emitted token have not been inspected; verify before treating this as confirmed.

## Classification and current access limitation

Do not set `MICROSOFT_GROUP_MEMBERSHIP_MODE` or the student/staff group ID variables until the tenant administrator verifies the object IDs and approves direct-membership semantics. Only direct student and staff group classification is currently implemented.

There is currently no Entra-group mapping for `ADMIN`, `HOD`, or `DEPUTY_HOD`. In production the staff resolver returns no application roles. Also, login requires a synced external identity to already be linked to an active legacy staff/student row. Consequently, adding Graph credentials alone does not make all tenant users able to sign in or use privileged features. Leave unverified users unclassified and privileged operations denied; do not work around this with guessed groups, fabricated academic fields, or manual identity links.

Batch and class values are available only from explicitly configured authoritative Graph user properties. The directory does not inherently provide register numbers, official academic rosters, subjects, timetables, or attendance.

The Students and Staff pages show only identities in the corresponding verified Entra groups. Configure the server-side Graph credentials, complete a successful full sync, and configure administrator-verified direct group IDs before expecting names there. Until a successful full sync exists, the UI reports directory counts as unavailable rather than showing zero.

## Subjects

Subjects are not retrieved from Entra. Existing subject rows are preserved for historical timetable and attendance references, tagged `LEGACY_UNVERIFIED`, and omitted from the normal subject list. Use **Add Subject** to enter college-confirmed values manually; these rows are tagged `MANUALLY_ENTERED`, not as Entra-verified or official-system-verified. Re-entering a legacy code updates the legacy row only when it has no class or timetable references; referenced legacy rows are preserved and cannot be overwritten, edited, newly assigned, or deleted.

Apply database migrations with `npm run db:migrate -w apps/server` after confirming `DATABASE_URL` points to the intended database. Migration `0011_subject_provenance` adds the provenance field without deleting or rewriting existing subject records.

## Local run and checks

From the repository root:

```powershell
npm install
npm run dev
```

Confirm the actual ports printed by the processes. After tenant permissions and server credentials have been configured, an authorized account can check `GET /api/auth/directory-status` and invoke the admin-only `POST /api/auth/sync-directory`.

Treat the sync as verified only when the latest full run is `SUCCEEDED`, the scan/page counts are complete, and the timestamp is present. Before a first successful full sync, zero counts mean no successful snapshot is available; they do not mean the tenant has zero users. Do not claim live login or synchronization until exercised successfully against the configured tenant.

Server integration tests require a dedicated loopback PostgreSQL database whose name ends in `_test`. The server refuses test-mode connections to other databases. Do not run tests against the local development or production database; the test runner does not create or migrate the test database automatically.

## Existing application data

The dashboard and Subjects, Timetable, and Attendance screens may query historical application tables. Their source provenance is not established by the Entra sync and those values are not verified official records. Preserve historical attendance. Do not run cleanup against the local database without first taking a backup and examining record provenance.
