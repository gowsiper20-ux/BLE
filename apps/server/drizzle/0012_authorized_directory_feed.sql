ALTER TABLE "external_identities"
  ADD COLUMN "user_principal_name" varchar(255),
  ADD COLUMN "job_title" varchar(255),
  ADD COLUMN "source" varchar(50) NOT NULL DEFAULT 'LEGACY_UNVERIFIED',
  ADD COLUMN "is_present" boolean NOT NULL DEFAULT false,
  ADD COLUMN "last_seen_at" timestamp;

ALTER TABLE "directory_sync_runs"
  ADD COLUMN "snapshot_id" varchar(100),
  ADD COLUMN "schema_version" varchar(20),
  ADD COLUMN "source" varchar(50) NOT NULL DEFAULT 'LEGACY_UNVERIFIED',
  ADD COLUMN "exported_at" timestamp,
  ADD COLUMN "ingested_at" timestamp,
  ADD COLUMN "complete_snapshot" boolean NOT NULL DEFAULT false,
  ADD COLUMN "membership_mode" varchar(20),
  ADD COLUMN "payload_sha256" varchar(64);

ALTER TABLE "directory_sync_run_members"
  ADD COLUMN "user_principal_name" varchar(255),
  ADD COLUMN "job_title" varchar(255);

CREATE UNIQUE INDEX "directory_sync_runs_snapshot_id_unique_idx"
  ON "directory_sync_runs" USING btree ("snapshot_id");
CREATE INDEX "directory_sync_runs_source_status_exported_idx"
  ON "directory_sync_runs" USING btree ("source", "status", "exported_at");
