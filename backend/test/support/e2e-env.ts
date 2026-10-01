import { randomBytes } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveTestDatabaseUrl } from './test-database.js';

// Se ejecuta antes de importar AppModule: ConfigModule lee process.env al cargarse.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = resolveTestDatabaseUrl();
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.COOKIE_SECURE = 'false';
// Límite corto para probar el 503 por tiempo sin alargar la suite.
process.env.REQUEST_TIMEOUT_MS = '3000';
process.env.UPLOADS_DIR = mkdtempSync(join(tmpdir(), 'cmpc-e2e-uploads-'));
