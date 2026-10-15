import postgres from 'postgres';
import 'dotenv/config';

async function migrate() {
  const client = postgres(process.env.DATABASE_URL!);
  
  try {
    console.log('Removing rooms from timetable...');
    
    // Drop unique index for rooms in timetables
    await client.unsafe(`DROP INDEX IF EXISTS room_conflict_idx;`);
    
    // Drop columns referencing rooms
    await client.unsafe(`ALTER TABLE "timetables" DROP COLUMN IF EXISTS "room_id" CASCADE;`);
    await client.unsafe(`ALTER TABLE "timetable_overrides" DROP COLUMN IF EXISTS "replacement_room_id" CASCADE;`);
    
    // Drop rooms table completely
    await client.unsafe(`DROP TABLE IF EXISTS "rooms" CASCADE;`);
    
    console.log('Successfully removed Rooms concept from database.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.end();
  }
}

migrate();
