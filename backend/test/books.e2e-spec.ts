import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

// Requiere la base de desarrollo migrada y con seed (ver README del backend).
describe('API de libros (e2e)', () => {
  let app: NestExpressApplication;
  let cookie: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL ?? 'admin@cmpc.cl',
        password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!',
      })
      .expect(200);
    cookie = String(login.headers['set-cookie']).split(';')[0];
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health responde ok sin sesión', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(body.data.status).toBe('ok');
  });

  it('rechaza /api/books sin sesión con el formato de error uniforme', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/api/books')
      .expect(401);
    expect(body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
      path: '/api/books',
    });
  });

  it('crea, lee, edita, elimina y restaura un libro con auditoría', async () => {
    const server = app.getHttpServer();
    const title = `Libro e2e ${Date.now()}`;

    const created = await request(server)
      .post('/api/books')
      .set('Cookie', cookie)
      .send({
        title,
        authorName: 'Autor e2e',
        publisherName: 'Editorial e2e',
        genreName: 'Género e2e',
        price: 1000,
        stock: 0,
      })
      .expect(201);
    const id = created.body.data.id as string;
    expect(created.body.data).toMatchObject({
      title,
      price: 1000,
      available: false,
    });

    await request(server)
      .patch(`/api/books/${id}`)
      .set('Cookie', cookie)
      .send({ stock: 2 })
      .expect(200);
    await request(server)
      .delete(`/api/books/${id}`)
      .set('Cookie', cookie)
      .expect(204);
    await request(server)
      .get(`/api/books/${id}`)
      .set('Cookie', cookie)
      .expect(404);
    await request(server)
      .post(`/api/books/${id}/restore`)
      .set('Cookie', cookie)
      .expect(200);

    const audit = await request(server)
      .get(`/api/audit-logs?entity=Book&entityId=${id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(
      audit.body.data.map((log: { action: string }) => log.action),
    ).toEqual(['RESTORE', 'DELETE', 'UPDATE', 'CREATE']);

    await request(server)
      .delete(`/api/books/${id}`)
      .set('Cookie', cookie)
      .expect(204);
  });

  it('exporta CSV con BOM y encabezados', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/books/export?available=false')
      .set('Cookie', cookie)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () =>
          callback(null, Buffer.concat(chunks).toString('utf8')),
        );
      })
      .expect(200);
    expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect((response.body as string).startsWith('﻿ID,Título,Autor')).toBe(true);
  });
});
