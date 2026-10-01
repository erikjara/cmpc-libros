import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createE2eApp, login, type E2eApp } from './support/e2e-app.js';

interface RegisteredRoute {
  method: string;
  path: string;
}

/** Rutas públicas de la API registradas en el router (login, logout y health). */
const PUBLIC_ROUTES = new Set([
  'POST /api/auth/login',
  'POST /api/auth/logout',
  'GET /api/health',
]);

// Swagger UI y el documento OpenAPI (`GET /api/docs*`) también son públicos.
const PUBLIC_PREFIX = 'GET /api/docs';

function isPublic({ method, path }: RegisteredRoute): boolean {
  const key = `${method} ${path}`;
  return PUBLIC_ROUTES.has(key) || key.startsWith(PUBLIC_PREFIX);
}

const SAMPLE_ID = '00000000-0000-4000-8000-000000000000';

/** Recorre el router de Express y devuelve las rutas que registró Nest. */
function registeredRoutes(ctx: E2eApp): RegisteredRoute[] {
  const express = ctx.app.getHttpAdapter().getInstance() as {
    router: {
      stack: {
        route?: { path: string; methods: Record<string, boolean> };
      }[];
    };
  };
  // Se omite el comodín `/api{/*splat}` con el que Nest responde 404 a rutas inexistentes.
  return express.router.stack.flatMap((layer) =>
    layer.route && !layer.route.path.includes('*')
      ? Object.keys(layer.route.methods)
          .filter((method) => method !== '_all')
          .map((method) => ({
            method: method.toUpperCase(),
            path: layer.route!.path,
          }))
      : [],
  );
}

describe('Autenticación (e2e)', () => {
  let ctx: E2eApp;
  let cookie: string;

  beforeAll(async () => {
    ctx = await createE2eApp();
    cookie = await login(ctx.server, ctx.credentials);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('el guard global exige sesión en todas las rutas registradas salvo las públicas', async () => {
    const routes = registeredRoutes(ctx);
    const protectedRoutes = routes.filter((route) => !isPublic(route));

    // Las rutas públicas existen y el resto es una lista no trivial.
    for (const route of PUBLIC_ROUTES) {
      expect(routes.map(({ method, path }) => `${method} ${path}`)).toContain(
        route,
      );
    }
    expect(protectedRoutes.length).toBeGreaterThanOrEqual(13);
    expect(protectedRoutes).toContainEqual({
      method: 'GET',
      path: '/api/books/trash',
    });

    for (const { method, path } of protectedRoutes) {
      const url = path.replace(/:[A-Za-z]+/g, SAMPLE_ID);
      const response = await request(ctx.server)[method.toLowerCase() as 'get'](
        url,
      );
      expect({ route: `${method} ${path}`, status: response.status }).toEqual({
        route: `${method} ${path}`,
        status: 401,
      });
      expect(response.body).toMatchObject({
        statusCode: 401,
        message: 'No autenticado',
      });
    }
  });

  it('login emite la cookie httpOnly y la sesión permite consultar /auth/me', async () => {
    const { body } = await request(ctx.server)
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect(body.data).toMatchObject({ email: ctx.credentials.email });
  });

  it('la cookie de sesión es httpOnly, SameSite=Strict y con path /', async () => {
    const response = await request(ctx.server)
      .post('/api/auth/login')
      .send(ctx.credentials)
      .expect(200);
    const setCookie = String(response.headers['set-cookie']);
    expect(setCookie).toMatch(/cmpc_session=[^;]+/);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).toContain('Path=/');
    expect(response.body.data.user).toEqual({
      id: expect.any(String),
      email: ctx.credentials.email,
      name: 'Usuario e2e',
    });
  });

  it('credenciales inválidas responden 401 con el formato de error', async () => {
    const { body } = await request(ctx.server)
      .post('/api/auth/login')
      .send({ email: ctx.credentials.email, password: 'incorrecta' })
      .expect(401);
    expect(body).toMatchObject({
      statusCode: 401,
      message: 'Credenciales inválidas',
      path: '/api/auth/login',
      requestId: expect.any(String),
    });
  });

  it('Bearer también autentica (misma sesión)', async () => {
    const token = cookie.split('=')[1];
    await request(ctx.server)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  describe('logout', () => {
    it('responde 204, expira la cookie e invalida el token como cookie y como Bearer', async () => {
      const token = cookie.split('=')[1];
      const response = await request(ctx.server)
        .post('/api/auth/logout')
        .set('Cookie', cookie)
        .expect(204);
      expect(String(response.headers['set-cookie'])).toMatch(
        /cmpc_session=;.*Expires=Thu, 01 Jan 1970/,
      );

      for (const auth of [
        { header: 'Cookie', value: cookie },
        { header: 'Authorization', value: `Bearer ${token}` },
      ]) {
        const { body } = await request(ctx.server)
          .get('/api/auth/me')
          .set(auth.header, auth.value)
          .expect(401);
        expect(body).toMatchObject({
          statusCode: 401,
          message: 'No autenticado',
        });
      }
    });

    it('un login nuevo funciona y un logout por Bearer también lo invalida', async () => {
      const fresh = await login(ctx.server, ctx.credentials);
      await request(ctx.server)
        .get('/api/auth/me')
        .set('Cookie', fresh)
        .expect(200);

      await request(ctx.server)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${fresh.split('=')[1]}`)
        .expect(204);
      await request(ctx.server)
        .get('/api/auth/me')
        .set('Cookie', fresh)
        .expect(401);
    });

    it('responde 204 sin token, con un token basura o con uno ya revocado', async () => {
      await request(ctx.server).post('/api/auth/logout').expect(204);
      await request(ctx.server)
        .post('/api/auth/logout')
        .set('Cookie', 'cmpc_session=basura')
        .expect(204);
      await request(ctx.server)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer basura.basura.basura')
        .expect(204);

      const before = await ctx.prisma.user.findUniqueOrThrow({
        where: { email: ctx.credentials.email },
      });
      await request(ctx.server)
        .post('/api/auth/logout')
        .set('Cookie', cookie)
        .expect(204);
      const after = await ctx.prisma.user.findUniqueOrThrow({
        where: { email: ctx.credentials.email },
      });
      expect(after.tokenVersion).toBe(before.tokenVersion);
    });

    it('un token bien firmado de un usuario inexistente responde 401', async () => {
      const token = await ctx.app.get(JwtService).signAsync({
        sub: randomUUID(),
        email: 'nadie@cmpc.test',
        tv: 0,
      });
      const { body } = await request(ctx.server)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
      expect(body.message).toBe('No autenticado');
    });
  });

  it('login registra LOGIN en la auditoría', async () => {
    const logs = await ctx.prisma.auditLog.findMany({
      where: { action: 'LOGIN' },
    });
    expect(logs.length).toBeGreaterThanOrEqual(2);
  });
});
