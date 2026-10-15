CREATE TYPE "public"."ble_token_status" AS ENUM('ACTIVE', 'EXPIRED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."attendance_record_source" AS ENUM('BLE', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."attendance_record_status" AS ENUM('PRESENT', 'ABSENT', 'LATE', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."ble_device_status" AS ENUM('ACTIVE', 'INACTIVE', 'REVOKED');--> statement-breakpoint
CREATE TABLE "attendance_ble_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attendance_session_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"issued_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"status" "ble_token_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attendance_session_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" "attendance_record_status" NOT NULL,
	"source" "attendance_record_source" NOT NULL,
	"first_detected_at" timestamp,
	"last_detected_at" timestamp,
	"detection_count" integer DEFAULT 0 NOT NULL,
	"marked_at" timestamp NOT NULL,
	"marked_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_ble_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"device_id" varchar(255) NOT NULL,
	"device_name" varchar(255),
	"ble_identifier" varchar(255) NOT NULL,
	"status" "ble_device_status" DEFAULT 'ACTIVE' NOT NULL,
	"last_seen_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance_ble_tokens" ADD CONSTRAINT "attendance_ble_tokens_attendance_session_id_attendance_sessions_id_fk" FOREIGN KEY ("attendance_session_id") REFERENCES "public"."attendance_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_ble_tokens" ADD CONSTRAINT "attendance_ble_tokens_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_attendance_session_id_attendance_sessions_id_fk" FOREIGN KEY ("attendance_session_id") REFERENCES "public"."attendance_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_marked_by_staff_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_ble_devices" ADD CONSTRAINT "student_ble_devices_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "token_session_student_idx" ON "attendance_ble_tokens" USING btree ("attendance_session_id","student_id");--> statement-breakpoint
CREATE INDEX "token_hash_idx" ON "attendance_ble_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "record_session_student_idx" ON "attendance_records" USING btree ("attendance_session_id","student_id");