import { randomBytes } from 'node:crypto';
import { rm } from 'node:fs/promises';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { PasswordHasher } from '../../src/auth/password-hasher.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { assertTestDatabaseName } from './test-database.js';

type App = Parameters<typeof request>[0];

export interface E2eCredentials {
  email: string;
  password: string;
}

export interface E2eApp {
  app: NestExpressApplication;
  server: App;
  prisma: PrismaService;
  credentials: E2eCredentials;
  close(): Promise<void>;
}

/** Credenciales del usuario de prueba; la contraseña se genera en cada ejecución. */
export function e2eCredentials(): E2eCredentials {
  return {
    email: process.env.E2E_USER_EMAIL ?? 'e2e@cmpc.test',
    password:
      process.env.E2E_USER_PASSWORD ?? `E2e-${randomBytes(12).toString('hex')}`,
  };
}

/** Vacía todas las tablas de la base de test (se niega a operar sobre otra base). */
export async function truncateAll(prisma: PrismaService): Promise<void> {
  const [{ name }] = await prisma.$queryRaw<
    { name: string }[]
  >`SELECT current_database() AS name`;
  assertTestDatabaseName(name);
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE audit_logs, books, authors, publishers, genres, users CASCADE',
  );
}

/** Levanta la app completa contra la base de test, limpia y con un usuario de prueba. */
export async function createE2eApp(): Promise<E2eApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: false,
  });
  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);
  await truncateAll(prisma);
  const credentials = e2eCredentials();
  await prisma.user.create({
    data: {
      email: credentials.email,
      name: 'Usuario e2e',
      passwordHash: await new PasswordHasher().hash(credentials.password),
    },
  });

  return {
    app,
    server: app.getHttpServer() as App,
    prisma,
    credentials,
    async close() {
      await truncateAll(prisma);
      await app.close();
      await rm(process.env.UPLOADS_DIR ?? '', { recursive: true, force: true });
    },
  };
}

/** Inicia sesión y devuelve el par `cmpc_session=<jwt>` para el header Cookie. */
export async function login(
  server: App,
  credentials: E2eCredentials,
): Promise<string> {
  const response = await request(server)
    .post('/api/auth/login')
    .send(credentials)
    .expect(200);
  const cookies = response.headers['set-cookie'] as unknown as string[];
  const session = cookies.find((cookie) => cookie.startsWith('cmpc_session='));
  if (!session) {
    throw new Error('El login no emitió la cookie cmpc_session');
  }
  return session.split(';')[0];
}
