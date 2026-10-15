CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_name" varchar(255),
	"actor_role" varchar(50),
	"action" varchar(50) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(100),
	"description" text NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staff_credentials_staff_id_unique" UNIQUE("staff_id")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar(50) NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"type" varchar(20) DEFAULT 'string' NOT NULL,
	"description" text,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_staff_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "staff_credentials" ADD CONSTRAINT "staff_credentials_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "system_settings" ("category", "key", "value", "type", "description") VALUES
	('general', 'INSTITUTION_NAME', 'Smart Attendance System', 'string', 'Name of the institution'),
	('general', 'TIMEZONE', 'Asia/Kolkata', 'string', 'System timezone'),
	('attendance', 'ATTENDANCE_THRESHOLD', '75', 'number', 'Minimum attendance percentage required'),
	('attendance', 'ATTENDANCE_START_EARLY_MINUTES', '10', 'number', 'Minutes before period start when attendance can be marked'),
	('attendance', 'MANUAL_CORRECTION_ENABLED', 'true', 'boolean', 'Allow staff to manually correct attendance'),
	('notifications', 'ATTENDANCE_SESSION_NOTIFICATIONS', 'true', 'boolean', 'Notify staff when sessions start/end'),
	('notifications', 'LOW_ATTENDANCE_NOTIFICATIONS', 'false', 'boolean', 'Notify students with low attendance')
ON CONFLICT ("key") DO NOTHING;
