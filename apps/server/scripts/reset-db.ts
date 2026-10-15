import 'dotenv/config';
import postgres from 'postgres';

async function reset() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL must be set in apps/server/.env.');
  }

  const databaseUrl = new URL(connectionString);
  const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
  if (!databaseName || !/^[a-zA-Z0-9_]+$/.test(databaseName)) {
    throw new Error('DATABASE_URL must specify a database name containing only letters, numbers, and underscores.');
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname)) {
    throw new Error('This reset script only operates on a local database.');
  }
  if (process.env.RESET_DATABASE !== databaseName) {
    throw new Error(`Set RESET_DATABASE=${databaseName} to confirm deleting and recreating this local database.`);
  }

  const maintenanceUrl = new URL(databaseUrl);
  maintenanceUrl.pathname = '/postgres';
  const client = postgres(maintenanceUrl.toString(), { max: 1 });
  try {
    await client.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await client.unsafe(`CREATE DATABASE "${databaseName}"`);
    console.log(`Database "${databaseName}" was reset.`);
  } finally {
    await client.end();
  }
}

reset().catch((error: unknown) => {
  console.error('Database reset failed:', error);
  process.exitCode = 1;
});
