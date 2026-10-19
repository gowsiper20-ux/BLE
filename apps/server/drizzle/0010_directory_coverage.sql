ALTER TABLE "external_identities" ALTER COLUMN "college_email" DROP NOT NULL;
ALTER TABLE "external_identities" ADD COLUMN "display_name" varchar(255);
ALTER TABLE "external_identities" ADD COLUMN "account_enabled" boolean;
ALTER TABLE "external_identities" ADD COLUMN "group_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL;
ALTER TABLE "external_identities" ADD COLUMN "directory_department" varchar(255);
ALTER TABLE "external_identities" ADD COLUMN "academic_batch" varchar(255);
ALTER TABLE "external_identities" ADD COLUMN "academic_class" varchar(255);
ALTER TABLE "external_identities" ADD COLUMN "last_synced_at" timestamp;
CREATE TYPE "directory_sync_status" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');
CREATE TABLE "directory_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "directory_sync_status" DEFAULT 'RUNNING' NOT NULL,
	"mode" varchar(20) DEFAULT 'FULL' NOT NULL,
	"pages_processed" integer DEFAULT 0 NOT NULL,
	"users_scanned" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"failure_page" integer,
	"error_code" varchar(100),
	"error_message" text
);
CREATE TABLE "directory_sync_run_members" (
	"run_id" uuid NOT NULL REFERENCES "directory_sync_runs"("id"),
	"identity_id" uuid NOT NULL REFERENCES "external_identities"("id"),
	"display_name" varchar(255),
	"college_email" varchar(255),
	"directory_department" varchar(255),
	"academic_batch" varchar(255),
	"academic_class" varchar(255),
	"account_enabled" boolean,
	"group_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "directory_sync_run_members_run_identity_idx" ON "directory_sync_run_members" USING btree ("run_id","identity_id");
