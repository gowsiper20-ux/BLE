CREATE TABLE "faculty_auth_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "email" varchar(254) NOT NULL,
  "password_hash" varchar(255) NOT NULL,
  "role" varchar(30) DEFAULT 'FACULTY' NOT NULL,
  "status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
  "session_version" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "faculty_auth_accounts_role_check" CHECK ("role" = 'FACULTY'),
  CONSTRAINT "faculty_auth_accounts_status_check" CHECK ("status" in ('ACTIVE', 'INACTIVE'))
);

CREATE UNIQUE INDEX "faculty_auth_accounts_email_lower_unique_idx"
  ON "faculty_auth_accounts" USING btree (lower("email"));
