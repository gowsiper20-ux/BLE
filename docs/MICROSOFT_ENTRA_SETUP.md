# Legacy Microsoft identity data

Microsoft Entra and Microsoft Graph are not required by the admin web application or its current HOD sign-in workflow. The admin frontend no longer initializes MSAL, and the API no longer mounts the Microsoft login or directory-snapshot routes.

Historical Microsoft identity and directory-snapshot tables, columns, and migration files are intentionally retained. No migration drops those tables or deletes any mapped identities. The signed directory-feed implementation remains in source/history but is not registered by the active server entry point.

The student and professor application source trees were not modified as part of the admin authentication and academic-record workflow. The backend retains application-issued bearer-session verification against existing identity mappings, but its direct Microsoft access-token validation and identity-resolution methods currently have no route callers. The student login endpoint is development-only; the professor app reports Entra sign-in as unconfigured. No production mobile sign-in flow is claimed or validated. Do not restore a Microsoft login or directory sync path to the admin application without a separate, explicit design and security review.

Use the local HOD bootstrap and server setup procedure in the [main README](../README.md). Do not configure Microsoft variables in the admin environment. The active backend example environment contains only the database, session, email-domain, and API configuration used by the current flows.
