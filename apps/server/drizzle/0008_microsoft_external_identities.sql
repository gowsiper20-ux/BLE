CREATE TABLE "external_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid,
	"student_id" uuid,
	"provider" varchar(50) DEFAULT 'MICROSOFT' NOT NULL,
	"tenant_id" varchar(255) NOT NULL,
	"oid" varchar(255) NOT NULL,
	"college_email" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "ext_identities_tenant_oid_idx" ON "external_identities" USING btree ("tenant_id","oid");
