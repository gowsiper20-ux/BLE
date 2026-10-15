import postgres from 'postgres';
import 'dotenv/config';

async function migrate() {
  const client = postgres(process.env.DATABASE_URL!);
  
  try {
    console.log('Creating audit_logs table...');
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
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
    `);
    
    // Add foreign key if not exists (ignore error if it exists)
    try {
      await client.unsafe(`
        ALTER TABLE "audit_logs" 
        ADD CONSTRAINT "audit_logs_actor_id_staff_id_fk" FOREIGN KEY ("actor_id") REFERENCES "staff"("id") ON DELETE no action ON UPDATE no action;
      `);
      console.log('Foreign key added.');
    } catch (e: any) {
      if (!e.message.includes('already exists')) {
        console.log('FK notice:', e.message);
      }
    }
    
    console.log('Audit migration complete.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.end();
  }
}

migrate();
