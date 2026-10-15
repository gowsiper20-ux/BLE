import postgres from 'postgres';
import 'dotenv/config';

async function migrate() {
  const client = postgres(process.env.DATABASE_URL!);
  
  try {
    console.log('Creating system_settings table...');
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "system_settings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "category" varchar(50) NOT NULL,
        "key" varchar(100) NOT NULL UNIQUE,
        "value" text NOT NULL,
        "type" varchar(20) DEFAULT 'string' NOT NULL,
        "description" text,
        "updated_by" uuid,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    
    // Initial Seed
    await client.unsafe(`
      INSERT INTO "system_settings" ("category", "key", "value", "type", "description") VALUES
      ('general', 'INSTITUTION_NAME', 'Smart Attendance System', 'string', 'Name of the institution'),
      ('general', 'TIMEZONE', 'Asia/Kolkata', 'string', 'System timezone'),
      ('attendance', 'ATTENDANCE_THRESHOLD', '75', 'number', 'Minimum attendance percentage required'),
      ('attendance', 'ATTENDANCE_START_EARLY_MINUTES', '10', 'number', 'Minutes before period start when attendance can be marked'),
      ('attendance', 'MANUAL_CORRECTION_ENABLED', 'true', 'boolean', 'Allow staff to manually correct attendance'),
      ('notifications', 'ATTENDANCE_SESSION_NOTIFICATIONS', 'true', 'boolean', 'Notify staff when sessions start/end'),
      ('notifications', 'LOW_ATTENDANCE_NOTIFICATIONS', 'false', 'boolean', 'Notify students with low attendance')
      ON CONFLICT ("key") DO NOTHING;
    `);

    console.log('Settings migration complete.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.end();
  }
}

migrate();
