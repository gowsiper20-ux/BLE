import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import 'dotenv/config';

async function runMigrations() {
    console.log('Running migrations...');
    const connectionString = process.env.DATABASE_URL!;
    const migrationClient = postgres(connectionString, { max: 1 });
    const db = drizzle(migrationClient);

    try {
        await migrate(db, { migrationsFolder: './drizzle' });
        console.log('Migrations complete.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await migrationClient.end();
    }
}

runMigrations().catch(console.error);
