import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function main() {
    console.log('Creating staff_credentials table...');
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "staff_credentials" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            "staff_id" uuid NOT NULL,
            "password_hash" varchar(255) NOT NULL,
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL,
            CONSTRAINT "staff_credentials_staff_id_unique" UNIQUE("staff_id"),
            CONSTRAINT "staff_credentials_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        );
    `);
    console.log('Done!');
    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
