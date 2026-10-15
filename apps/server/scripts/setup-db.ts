import 'dotenv/config';
import postgres from 'postgres';

async function setup() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL must be set in apps/server/.env.');
  }

  const maintenanceUrl = new URL(connectionString);
  const databaseName = decodeURIComponent(maintenanceUrl.pathname.slice(1));
  if (!databaseName || !/^[a-zA-Z0-9_]+$/.test(databaseName)) {
    throw new Error('DATABASE_URL must specify a database name containing only letters, numbers, and underscores.');
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(maintenanceUrl.hostname)) {
    throw new Error('This setup script only creates databases on the local machine.');
  }
  maintenanceUrl.pathname = '/postgres';

  const client = postgres(maintenanceUrl.toString(), { max: 1 });
  try {
    const result = await client`SELECT 1 FROM pg_database WHERE datname = ${databaseName}`;
    if (result.length === 0) {
      await client.unsafe(`CREATE DATABASE "${databaseName}"`);
      console.log(`Database "${databaseName}" created.`);
    } else {
      console.log(`Database "${databaseName}" already exists.`);
    }
  } finally {
    await client.end();
  }
}

setup().catch((error: unknown) => {
  console.error('Database setup failed:', error);
  process.exitCode = 1;
});
