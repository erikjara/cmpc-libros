import 'dotenv/config';

const TEST_SUFFIX = '_test';

/**
 * URL de la base de los tests e2e: `TEST_DATABASE_URL` o, si no existe, la misma
 * `DATABASE_URL` con el nombre de la base terminado en `_test` (p. ej. `cmpc_libros_test`).
 * Nunca apunta a la base de desarrollo.
 */
export function resolveTestDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const explicit = env.TEST_DATABASE_URL;
  const base = explicit ?? env.DATABASE_URL;
  if (!base) {
    throw new Error(
      'Define TEST_DATABASE_URL (o DATABASE_URL) para ejecutar los tests e2e',
    );
  }
  const url = new URL(base);
  if (!explicit) {
    url.pathname = `/${databaseName(base)}${TEST_SUFFIX}`;
  }
  assertTestDatabaseName(databaseName(url.toString()));
  return url.toString();
}

export function databaseName(connectionString: string): string {
  return decodeURIComponent(new URL(connectionString).pathname.slice(1));
}

export function assertTestDatabaseName(name: string): void {
  if (!/^[a-z0-9_]+$/.test(name) || !name.endsWith(TEST_SUFFIX)) {
    throw new Error(
      `La base de los tests e2e debe llamarse <nombre>${TEST_SUFFIX} (recibido: "${name}")`,
    );
  }
}
