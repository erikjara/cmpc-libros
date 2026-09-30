import { existsSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AuditLogsRepository } from '../src/audit/audit-logs.repository.js';
import { JPEG_BYTES, PNG_BYTES } from '../src/testing/image-fixtures.js';
import { createE2eApp, login, type E2eApp } from './support/e2e-app.js';

interface BookBody {
  id: string;
  title: string;
  imageUrl: string | null;
  author: { id: string; name: string };
}

const CSV_HEADER =
  'ID,Título,Autor,Editorial,Género,Precio,Stock,Disponible,Creado';

describe('API de libros (e2e)', () => {
  let ctx: E2eApp;
  let cookie: string;

  beforeAll(async () => {
    ctx = await createE2eApp();
    cookie = await login(ctx.server, ctx.credentials);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await ctx.close();
  });

  const api = () => request(ctx.server);

  async function createBook(
    overrides: Record<string, unknown> = {},
  ): Promise<BookBody> {
    const { body } = await api()
      .post('/api/books')
      .set('Cookie', cookie)
      .send({
        title: `Libro ${Math.random().toString(36).slice(2)}`,
        authorName: 'Autor e2e',
        publisherName: 'Editorial e2e',
        genreName: 'Género e2e',
        price: 1000,
        stock: 1,
        ...overrides,
      })
      .expect(201);
    return body.data as BookBody;
  }

  async function exportCsv(query = ''): Promise<string> {
    const response = await api()
      .get(`/api/books/export${query}`)
      .set('Cookie', cookie)
      .buffer(true)
      .expect(200);
    return response.text;
  }

  it('GET /api/health responde ok sin sesión', async () => {
    const { body } = await api().get('/api/health').expect(200);
    expect(body.data.status).toBe('ok');
  });

  it('crea, lee, edita, elimina y restaura un libro con auditoría', async () => {
    const created = await createBook({ title: 'Ciclo completo', stock: 0 });
    expect(created).toMatchObject({ title: 'Ciclo completo', imageUrl: null });

    await api()
      .patch(`/api/books/${created.id}`)
      .set('Cookie', cookie)
      .send({ stock: 2 })
      .expect(200);
    await api()
      .delete(`/api/books/${created.id}`)
      .set('Cookie', cookie)
      .expect(204);
    await api()
      .post(`/api/books/${created.id}/restore`)
      .set('Cookie', cookie)
      .expect(200);

    const { body } = await api()
      .get(`/api/audit-logs?entity=Book&entityId=${created.id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(body.data.map((log: { action: string }) => log.action)).toEqual([
      'RESTORE',
      'DELETE',
      'UPDATE',
      'CREATE',
    ]);
  });

  describe('soft delete', () => {
    let deleted: BookBody;

    beforeAll(async () => {
      deleted = await createBook({ title: 'Libro eliminado lógicamente' });
      await api()
        .delete(`/api/books/${deleted.id}`)
        .set('Cookie', cookie)
        .expect(204);
    });

    it('lo excluye del listado', async () => {
      const { body } = await api()
        .get('/api/books?search=eliminado')
        .set('Cookie', cookie)
        .expect(200);
      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
    });

    it('responde 404 en detalle, edición, imagen y un segundo borrado', async () => {
      const url = `/api/books/${deleted.id}`;
      await api().get(url).set('Cookie', cookie).expect(404);
      await api()
        .patch(url)
        .set('Cookie', cookie)
        .send({ stock: 5 })
        .expect(404);
      await api()
        .post(`${url}/image`)
        .set('Cookie', cookie)
        .attach('image', JPEG_BYTES, 'portada.jpg')
        .expect(404);
      await api().delete(url).set('Cookie', cookie).expect(404);
    });

    it('lo excluye de la exportación', async () => {
      const csv = await exportCsv('?search=eliminado');
      expect(csv.slice(1).trim()).toBe(CSV_HEADER);
    });

    it('restore lo devuelve al listado y al detalle', async () => {
      await api()
        .post(`/api/books/${deleted.id}/restore`)
        .set('Cookie', cookie)
        .expect(200);
      await api()
        .get(`/api/books/${deleted.id}`)
        .set('Cookie', cookie)
        .expect(200);
      const { body } = await api()
        .get('/api/books?search=eliminado')
        .set('Cookie', cookie)
        .expect(200);
      expect(body.data.map((book: BookBody) => book.id)).toEqual([deleted.id]);
    });
  });

  it('busca % y _ de forma literal', async () => {
    await createBook({ title: 'Descuento 100% real' });
    await createBook({ title: 'Cien por ciento' });
    await createBook({ title: 'variable_con_guion' });
    await createBook({ title: 'variable con guion' });

    const titles = async (search: string) => {
      const { body } = await api()
        .get('/api/books')
        .query({ search })
        .set('Cookie', cookie)
        .expect(200);
      return body.data.map((book: BookBody) => book.title);
    };

    expect(await titles('%')).toEqual(['Descuento 100% real']);
    expect(await titles('_')).toEqual(['variable_con_guion']);
  });

  it('pagina de forma estable desempatando por id', async () => {
    const created: BookBody[] = [];
    for (let index = 0; index < 5; index++) {
      created.push(
        await createBook({
          title: `Empate ${index}`,
          authorName: 'Autor paginación',
          price: 5000,
        }),
      );
    }
    const authorId = created[0].author.id;
    const expected = created.map((book) => book.id).sort();

    const seen: string[] = [];
    for (const page of [1, 2, 3]) {
      const { body } = await api()
        .get('/api/books')
        .query({ authorId, sort: 'price:asc', limit: 2, page })
        .set('Cookie', cookie)
        .expect(200);
      expect(body.meta).toEqual({ page, limit: 2, total: 5, totalPages: 3 });
      seen.push(...body.data.map((book: BookBody) => book.id));
    }
    expect(seen).toEqual(expected);

    const { body } = await api()
      .get('/api/books')
      .query({ authorId, limit: 2, page: 4 })
      .set('Cookie', cookie)
      .expect(200);
    expect(body.data).toEqual([]);
  });

  it('rechaza con 400 una página demasiado grande', async () => {
    const { body } = await api()
      .get('/api/books?page=1000001')
      .set('Cookie', cookie)
      .expect(400);
    expect(body.message).toEqual(['page no puede ser mayor a 1000000']);
  });

  it('si falla la auditoría, la transacción se revierte y el libro no queda creado', async () => {
    vi.spyOn(ctx.app.get(AuditLogsRepository), 'create').mockRejectedValueOnce(
      new Error('fallo de auditoría'),
    );

    const { body } = await api()
      .post('/api/books')
      .set('Cookie', cookie)
      .send({
        title: 'Libro que no debe existir',
        authorName: 'Autor revertido',
        publisherName: 'Editorial revertida',
        genreName: 'Género revertido',
        price: 1000,
        stock: 1,
      })
      .expect(500);

    expect(body).toMatchObject({
      statusCode: 500,
      message: 'Error interno del servidor',
    });
    await expect(
      ctx.prisma.book.count({ where: { title: 'Libro que no debe existir' } }),
    ).resolves.toBe(0);
    await expect(
      ctx.prisma.author.count({ where: { name: 'Autor revertido' } }),
    ).resolves.toBe(0);
  });

  describe('imagen', () => {
    it('sube y reemplaza la imagen; la anterior se elimina del disco', async () => {
      const book = await createBook();
      const first = await api()
        .post(`/api/books/${book.id}/image`)
        .set('Cookie', cookie)
        .attach('image', JPEG_BYTES, 'portada.jpg')
        .expect(200);
      const firstUrl = first.body.data.imageUrl as string;
      expect(firstUrl).toMatch(/^\/api\/uploads\/[0-9a-f-]{36}\.jpg$/);
      await api().get(firstUrl).expect(200);

      const second = await api()
        .post(`/api/books/${book.id}/image`)
        .set('Cookie', cookie)
        .attach('image', PNG_BYTES, 'portada.png')
        .expect(200);
      expect(second.body.data.imageUrl).toMatch(/\.png$/);
      const firstFile = join(
        process.env.UPLOADS_DIR ?? '',
        firstUrl.split('/').pop() ?? '',
      );
      expect(existsSync(firstFile)).toBe(false);
    });

    it('responde 413 si supera 2 MB', async () => {
      const book = await createBook();
      const tooLarge = Buffer.concat([
        JPEG_BYTES,
        Buffer.alloc(2 * 1024 * 1024),
      ]);
      const { body } = await api()
        .post(`/api/books/${book.id}/image`)
        .set('Cookie', cookie)
        .attach('image', tooLarge, 'grande.jpg')
        .expect(413);
      expect(body.message).toBe('La imagen supera el tamaño máximo de 2 MB');
    });

    it('responde 400 si no es JPEG, PNG ni WebP o si falta el archivo', async () => {
      const book = await createBook();
      const invalid = await api()
        .post(`/api/books/${book.id}/image`)
        .set('Cookie', cookie)
        .attach('image', Buffer.from('GIF89a-contenido'), {
          filename: 'falsa.jpg',
          contentType: 'image/jpeg',
        })
        .expect(400);
      expect(invalid.body.message).toBe(
        'Formato de imagen no permitido: usa JPEG, PNG o WebP',
      );

      const missing = await api()
        .post(`/api/books/${book.id}/image`)
        .set('Cookie', cookie)
        .field('otro', 'valor')
        .expect(400);
      expect(missing.body.message).toBe(
        'Debes adjuntar una imagen en el campo "image"',
      );
    });
  });

  describe('exportación CSV', () => {
    it('entrega BOM, encabezados del contrato y los libros filtrados', async () => {
      await createBook({ title: 'Exportable, con "comillas"', stock: 0 });
      const response = await api()
        .get('/api/books/export?search=Exportable')
        .set('Cookie', cookie)
        .buffer(true)
        .expect(200);

      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.headers['content-disposition']).toMatch(
        /^attachment; filename="libros-\d{4}-\d{2}-\d{2}\.csv"$/,
      );
      expect(response.text.startsWith(`﻿${CSV_HEADER}\n`)).toBe(true);
      const lines = response.text.trim().split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain('"Exportable, con ""comillas"""');
      expect(lines[1]).toContain(',No,');
    });
  });
});
