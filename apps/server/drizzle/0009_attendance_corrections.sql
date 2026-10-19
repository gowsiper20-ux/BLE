CREATE TABLE IF NOT EXISTS "attendance_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attendance_record_id" uuid NOT NULL REFERENCES "attendance_records"("id") ON DELETE CASCADE,
	"previous_status" varchar(50) NOT NULL,
	"new_status" varchar(50) NOT NULL,
	"reason" text NOT NULL,
	"corrected_by" uuid NOT NULL REFERENCES "staff"("id"),
	"created_at" timestamp DEFAULT now() NOT NULL
);
