CREATE TYPE "public"."student_status" AS ENUM('ACTIVE', 'INACTIVE', 'GRADUATED', 'SUSPENDED');--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"register_number" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"college_email" varchar(255) NOT NULL,
	"microsoft_user_id" varchar(255),
	"class_id" uuid NOT NULL,
	"status" "student_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "students_register_number_unique" UNIQUE("register_number"),
	CONSTRAINT "students_college_email_unique" UNIQUE("college_email"),
	CONSTRAINT "students_microsoft_user_id_unique" UNIQUE("microsoft_user_id")
);
--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;