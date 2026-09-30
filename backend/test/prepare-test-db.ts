import { spawnSync } from 'node:child_process';
import pg from 'pg';
import {
  databaseName,
  resolveTestDatabaseUrl,
} from './support/test-database.js';

// Crea la base de los tests e2e si no existe y le aplica las migraciones.
const testUrl = resolveTestDatabaseUrl();
const name = databaseName(testUrl);

const maintenanceUrl = new URL(testUrl);
maintenanceUrl.pathname = '/postgres';
maintenanceUrl.search = '';

const client = new pg.Client({ connectionString: maintenanceUrl.toString() });
await client.connect();
try {
  const { rowCount } = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [name],
  );
  if (rowCount === 0) {
    // El nombre ya se validó con /^[a-z0-9_]+_test$/: es seguro interpolarlo.
    await client.query(`CREATE DATABASE "${name}"`);
    console.log(`Base de datos ${name} creada`);
  }
} finally {
  await client.end();
}

const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: testUrl },
});
if (migrate.status !== 0) {
  process.exit(migrate.status ?? 1);
}
