import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Controller, Get, Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildHelmetOptions, configureApp } from './app.setup.js';
import { DEMO_JWT_SECRETS } from './config/demo-secret.js';

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return 'pong';
  }
}

describe('buildHelmetOptions', () => {
  it('con HTTPS activa HSTS y upgrade-insecure-requests', () => {
    expect(buildHelmetOptions(true)).toEqual({
      strictTransportSecurity: true,
      contentSecurityPolicy: { directives: { upgradeInsecureRequests: [] } },
    });
  });
});

describe('configureApp', () => {
  let app: NestExpressApplication;
  let uploadsDir: string;

  beforeAll(async () => {
    uploadsDir = await mkdtemp(join(tmpdir(), 'cmpc-setup-'));
    await writeFile(
      join(uploadsDir, 'portada.png'),
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    );

    @Module({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: () => ({
            UPLOADS_DIR: uploadsDir,
            CORS_ORIGIN: 'http://localhost:5173',
            COOKIE_SECURE: false,
          }),
        }),
      ],
      controllers: [PingController],
    })
    class TestModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await rm(uploadsDir, { recursive: true, force: true });
  });

  it('aplica el prefijo global /api', async () => {
    await request(app.getHttpServer()).get('/api/ping').expect(200, 'pong');
    await request(app.getHttpServer()).get('/ping').expect(404);
  });

  it('agrega headers de seguridad de helmet sin forzar HTTPS', async () => {
    const response = await request(app.getHttpServer()).get('/api/ping');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toContain(
      "default-src 'self'",
    );
    expect(response.headers['content-security-policy']).not.toContain(
      'upgrade-insecure-requests',
    );
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  it('permite CORS con credenciales solo para el origen del frontend', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/ping')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET');
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('sirve las imágenes subidas bajo /api/uploads', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/uploads/portada.png')
      .expect(200);
    expect(response.headers['content-type']).toBe('image/png');
  });

  it('publica Swagger UI y el documento OpenAPI con cookie y bearer', async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(200);
    const { body } = await request(app.getHttpServer())
      .get('/api/docs/openapi.json')
      .expect(200);
    expect(body.info.title).toBe('CMPC-libros API');
    expect(Object.keys(body.components.securitySchemes)).toEqual([
      'cookie',
      'bearer',
    ]);
    expect(body.paths['/api/ping']).toBeDefined();
  });
});

describe('configureApp con el secreto de ejemplo en producción', () => {
  it('arranca y advierte que JWT_SECRET debe cambiarse', async () => {
    const uploadsDir = await mkdtemp(join(tmpdir(), 'cmpc-setup-'));
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    @Module({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          validate: () => ({
            NODE_ENV: 'production',
            JWT_SECRET: DEMO_JWT_SECRETS[1],
            UPLOADS_DIR: uploadsDir,
            CORS_ORIGIN: 'http://localhost:8080',
            COOKIE_SECURE: false,
          }),
        }),
      ],
    })
    class ProductionModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [ProductionModule],
    }).compile();
    const app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    configureApp(app);
    await app.init();

    expect(
      warn.mock.calls.some(([message]) =>
        String(message).includes('JWT_SECRET'),
      ),
    ).toBe(true);

    warn.mockRestore();
    await app.close();
    await rm(uploadsDir, { recursive: true, force: true });
  });
});
