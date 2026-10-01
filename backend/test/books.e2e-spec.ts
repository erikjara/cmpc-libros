import { existsSync, readdirSync } from 'node:fs';
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
import { EXPORT_BATCH_SIZE } from '../src/books/books-export.service.js';
import { BooksRepository } from '../src/books/books.repository.js';
import { makeBook } from '../src/testing/book-fixtures.js';
import { JPEG_BYTES, PNG_BYTES } from '../src/testing/image-fixtures.js';
import { createE2eApp, login, type E2eApp } from './support/e2e-app.js';

interface BookBody {
  id: string;
  title: string;
  imageUrl: string | null;
  author: { id: string; name: string };
  stock: number;
  updatedAt: string;
}

const BOOK_MODIFIED =
  'El libro fue modificado por otra persona. Recarga para ver la versión actual.';

const CSV_HEADER =
  'ID;Título;Autor;Editorial;Género;Precio;Stock;Disponible;Creado';

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

  describe('papelera', () => {
    interface TrashedBody extends BookBody {
      deletedAt: string;
    }

    async function deleteBook(id: string): Promise<void> {
      await api().delete(`/api/books/${id}`).set('Cookie', cookie).expect(204);
    }

    async function trash(query: Record<string, unknown> = {}) {
      const { body } = await api()
        .get('/api/books/trash')
        .query(query)
        .set('Cookie', cookie)
        .expect(200);
      return body as {
        data: TrashedBody[];
        meta: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      };
    }

    it('un libro eliminado aparece en la papelera con su fecha de eliminación y no en el listado', async () => {
      const book = await createBook({ title: 'Papelera ciclo e2e' });
      const before = Date.now();
      await deleteBook(book.id);
      const after = Date.now();

      const { data, meta } = await trash({ search: 'Papelera ciclo' });
      expect(meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
      expect(data).toEqual([
        expect.objectContaining({
          id: book.id,
          title: 'Papelera ciclo e2e',
          author: book.author,
          deletedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
        }),
      ]);
      const deletedAt = Date.parse(data[0].deletedAt);
      expect(deletedAt).toBeGreaterThanOrEqual(before - 1000);
      expect(deletedAt).toBeLessThanOrEqual(after + 1000);

      const { body } = await api()
        .get('/api/books?search=Papelera ciclo')
        .set('Cookie', cookie)
        .expect(200);
      expect(body.data).toEqual([]);
    });

    it('un libro restaurado desaparece de la papelera y vuelve al listado', async () => {
      const book = await createBook({ title: 'Papelera restaurado e2e' });
      await deleteBook(book.id);
      expect((await trash({ search: 'Papelera restaurado' })).meta.total).toBe(
        1,
      );

      await api()
        .post(`/api/books/${book.id}/restore`)
        .set('Cookie', cookie)
        .expect(200);

      expect(await trash({ search: 'Papelera restaurado' })).toMatchObject({
        data: [],
        meta: { total: 0, totalPages: 0 },
      });
      const { body } = await api()
        .get('/api/books?search=Papelera restaurado')
        .set('Cookie', cookie)
        .expect(200);
      expect(body.data.map((item: BookBody) => item.id)).toEqual([book.id]);
    });

    it('ordena por eliminación más reciente y pagina de forma estable', async () => {
      const deleted: BookBody[] = [];
      for (let index = 0; index < 3; index++) {
        const book = await createBook({ title: `Papelera orden ${index}` });
        await deleteBook(book.id);
        deleted.push(book);
      }
      const newestFirst = deleted.map((book) => book.id).reverse();

      const first = await trash({ search: 'Papelera orden', limit: 2 });
      expect(first.meta).toEqual({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
      const second = await trash({
        search: 'Papelera orden',
        limit: 2,
        page: 2,
      });
      expect([...first.data, ...second.data].map((book) => book.id)).toEqual(
        newestFirst,
      );

      const outOfRange = await trash({
        search: 'Papelera orden',
        limit: 2,
        page: 3,
      });
      expect(outOfRange).toEqual({
        data: [],
        meta: { page: 3, limit: 2, total: 3, totalPages: 2 },
      });
    });

    it('busca en título y autor, con % y _ literales', async () => {
      const byTitle = await createBook({ title: 'Papelera 100% e2e' });
      const other = await createBook({ title: 'Papelera cien e2e' });
      const byAuthor = await createBook({
        title: 'Sin pista en el título',
        authorName: 'Autora_papelera',
      });
      for (const book of [byTitle, other, byAuthor]) {
        await deleteBook(book.id);
      }

      const ids = async (search: string) =>
        (await trash({ search })).data.map((book) => book.id);

      expect(await ids('papelera 100%')).toEqual([byTitle.id]);
      expect(await ids('autora_papelera')).toEqual([byAuthor.id]);
      expect(await ids('AUTORA_')).toEqual([byAuthor.id]);
      expect(await ids('autora%papelera')).toEqual([]);
    });

    it('rechaza con 400 parámetros desconocidos y límites inválidos', async () => {
      const unknown = await api()
        .get('/api/books/trash?sort=title:asc')
        .set('Cookie', cookie)
        .expect(400);
      expect(unknown.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        message: ['La propiedad "sort" no está permitida'],
        path: '/api/books/trash?sort=title:asc',
      });

      const invalid = await api()
        .get('/api/books/trash?limit=101&page=0')
        .set('Cookie', cookie)
        .expect(400);
      expect(invalid.body.message).toEqual(
        expect.arrayContaining([
          'limit no puede ser mayor a 100',
          'page debe ser mayor o igual a 1',
        ]),
      );
    });

    it('no registra auditoría al consultar', async () => {
      const total = async () =>
        (
          await api()
            .get('/api/audit-logs?limit=1')
            .set('Cookie', cookie)
            .expect(200)
        ).body.meta.total as number;
      const before = await total();
      await trash();
      expect(await total()).toBe(before);
    });

    it('Swagger documenta la respuesta paginada con deletedAt', async () => {
      const { body } = await api().get('/api/docs/openapi.json').expect(200);
      const operation = body.paths['/api/books/trash'].get;
      expect(
        operation.responses['200'].content['application/json'].schema,
      ).toMatchObject({
        properties: {
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/TrashedBookResponseDto',
            },
          },
          meta: { $ref: '#/components/schemas/PaginationMetaDto' },
        },
      });
      expect(body.components.schemas.TrashedBookResponseDto.required).toEqual(
        expect.arrayContaining(['deletedAt', 'title', 'author']),
      );
      expect(operation.responses['401']).toBeDefined();
      expect(
        operation.parameters.map((p: { name: string }) => p.name).sort(),
      ).toEqual(['limit', 'page', 'search']);
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

  describe('caracteres de control en textos de entrada', () => {
    const validBook = {
      title: 'Libro con control',
      authorName: 'Autor e2e',
      publisherName: 'Editorial e2e',
      genreName: 'Género e2e',
      price: 1000,
      stock: 1,
    };

    it.each([
      ['title', 'El título'],
      ['authorName', 'El autor'],
      ['publisherName', 'La editorial'],
      ['genreName', 'El género'],
    ])(
      'POST /api/books con NUL en %s responde 400 sin crear el libro',
      async (field, label) => {
        const { body } = await api()
          .post('/api/books')
          .set('Cookie', cookie)
          .send({ ...validBook, [field]: 'a\u0000b' })
          .expect(400);
        expect(body).toMatchObject({
          statusCode: 400,
          error: 'Bad Request',
          message: [`${label} contiene caracteres no permitidos`],
          path: '/api/books',
        });
      },
    );

    it('PATCH con \\u0001 o \\u007f responde 400 y no modifica el libro', async () => {
      const book = await createBook();
      for (const title of ['x\u0001', 'x\u007f']) {
        const { body } = await api()
          .patch(`/api/books/${book.id}`)
          .set('Cookie', cookie)
          .send({ title })
          .expect(400);
        expect(body.message).toEqual([
          'El título contiene caracteres no permitidos',
        ]);
      }
      const { body } = await api()
        .get(`/api/books/${book.id}`)
        .set('Cookie', cookie)
        .expect(200);
      expect(body.data.title).toBe(book.title);
    });

    it('acepta tabs y saltos de línea en el body (se colapsan a un espacio)', async () => {
      const book = await createBook({ title: 'Con\ttab\ny  salto' });
      expect(book.title).toBe('Con tab y salto');
    });

    it.each([
      ['/api/books?search=a%00b', 'search'],
      ['/api/books?search=%01', 'search'],
      ['/api/books/export?search=a%00b', 'search'],
      ['/api/books/trash?search=a%7Fb', 'search'],
      ['/api/authors?search=a%00b', 'search'],
      ['/api/publishers?search=a%00b', 'search'],
      ['/api/genres?search=a%00b', 'search'],
      ['/api/audit-logs?entityId=a%00b', 'entityId'],
    ])('GET %s responde 400', async (url, field) => {
      const { body } = await api().get(url).set('Cookie', cookie).expect(400);
      expect(body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        message: [`${field} contiene caracteres no permitidos`],
        path: url,
      });
    });
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

  it('reutiliza autor, editorial y género aunque el nombre difiera en espacios', async () => {
    const first = await createBook({
      title: '  Espacios   uno ',
      authorName: '  Autor   Espaciado ',
      publisherName: 'Editorial \t Espaciada',
      genreName: 'Género\n\nEspaciado',
    });
    const second = await createBook({
      title: 'Espacios dos',
      authorName: 'Autor Espaciado',
      publisherName: 'Editorial Espaciada',
      genreName: 'Género Espaciado',
    });

    expect(first.title).toBe('Espacios uno');
    expect(first.author).toEqual(second.author);
    expect(first.author.name).toBe('Autor Espaciado');
    const stored = await ctx.prisma.book.findMany({
      where: { id: { in: [first.id, second.id] } },
      select: { authorId: true, publisherId: true, genreId: true },
    });
    expect(stored).toHaveLength(2);
    expect(stored[0]).toEqual(stored[1]);
    await expect(
      ctx.prisma.author.count({ where: { name: { contains: 'Espaciado' } } }),
    ).resolves.toBe(1);
  });

  /** Cuenta los registros cuyo nombre coincide sin distinguir mayúsculas. */
  function countCatalog(
    table: 'authors' | 'publishers' | 'genres',
    name: string,
  ) {
    return ctx.prisma
      .$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT count(*) AS count FROM ${table} WHERE lower(name) = lower($1)`,
        name,
      )
      .then(([row]) => Number(row.count));
  }

  it('reutiliza autor, editorial y género aunque el nombre difiera en mayúsculas', async () => {
    const first = await createBook({
      authorName: 'Pablo Neruda',
      publisherName: 'Editorial Mayúsculas',
      genreName: 'Género Mayúsculas',
    });
    const second = await createBook({
      authorName: 'pablo   NERUDA',
      publisherName: 'EDITORIAL mayúsculas',
      genreName: 'género MAYÚSCULAS',
    });

    expect(second.author).toEqual({
      id: first.author.id,
      name: 'Pablo Neruda',
    });
    const stored = await ctx.prisma.book.findMany({
      where: { id: { in: [first.id, second.id] } },
      include: { publisher: true, genre: true },
    });
    expect(stored).toHaveLength(2);
    expect(stored[0].publisherId).toBe(stored[1].publisherId);
    expect(stored[0].publisher.name).toBe('Editorial Mayúsculas');
    expect(stored[0].genreId).toBe(stored[1].genreId);
    expect(stored[0].genre.name).toBe('Género Mayúsculas');
    await expect(countCatalog('authors', 'Pablo Neruda')).resolves.toBe(1);
    await expect(
      countCatalog('publishers', 'Editorial Mayúsculas'),
    ).resolves.toBe(1);
    await expect(countCatalog('genres', 'Género Mayúsculas')).resolves.toBe(1);
  });

  it('la edición también conecta con el autor existente sin distinguir mayúsculas', async () => {
    const neruda = await createBook({ authorName: 'Pablo Neruda' });
    const other = await createBook({ authorName: 'Otro autor e2e' });

    const { body } = await api()
      .patch(`/api/books/${other.id}`)
      .set('Cookie', cookie)
      .send({ authorName: 'PABLO NERUDA' })
      .expect(200);

    expect(body.data.author).toEqual(neruda.author);
    await expect(countCatalog('authors', 'Pablo Neruda')).resolves.toBe(1);

    // Cambiar solo mayúsculas no es un cambio efectivo: no toca updatedAt.
    const { body: same } = await api()
      .patch(`/api/books/${other.id}`)
      .set('Cookie', cookie)
      .send({ authorName: 'pablo neruda' })
      .expect(200);
    expect(same.data.updatedAt).toBe(body.data.updatedAt);
  });

  it('altas simultáneas del mismo autor nuevo con distintas mayúsculas crean un solo autor', async () => {
    const variants = ['Autor Nuevo', 'autor nuevo', 'AUTOR NUEVO'];
    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        api()
          .post('/api/books')
          .set('Cookie', cookie)
          .send({
            title: `Mayúsculas concurrente ${index}`,
            authorName: variants[index % variants.length],
            publisherName: variants[index % variants.length].replace(
              /autor/i,
              'Editorial',
            ),
            genreName: variants[index % variants.length].replace(
              /autor/i,
              'Género',
            ),
            price: 1000,
            stock: 1,
          }),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual(
      Array(5).fill(201),
    );
    const authorIds = new Set(
      responses.map((response) => (response.body.data as BookBody).author.id),
    );
    expect(authorIds.size).toBe(1);
    await expect(countCatalog('authors', 'autor nuevo')).resolves.toBe(1);
    await expect(countCatalog('publishers', 'Editorial nuevo')).resolves.toBe(
      1,
    );
    await expect(countCatalog('genres', 'Género nuevo')).resolves.toBe(1);
  });

  it('creaciones simultáneas con el mismo autor nuevo no fallan por la carrera del upsert', async () => {
    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        api()
          .post('/api/books')
          .set('Cookie', cookie)
          .send({
            title: `Concurrente ${index}`,
            authorName: 'Autor concurrente',
            publisherName: 'Editorial concurrente',
            genreName: 'Género concurrente',
            price: 1000,
            stock: 1,
          }),
      ),
    );
    expect(responses.map((response) => response.status)).toEqual(
      Array(6).fill(201),
    );
    await expect(
      ctx.prisma.author.count({ where: { name: 'Autor concurrente' } }),
    ).resolves.toBe(1);
  });

  describe('bloqueo optimista (ETag / If-Match)', () => {
    const etagOf = (book: BookBody) => `"${book.updatedAt}"`;

    async function auditTotal(id: string): Promise<number> {
      const { body } = await api()
        .get(`/api/audit-logs?entity=Book&entityId=${id}`)
        .set('Cookie', cookie)
        .expect(200);
      return body.meta.total as number;
    }

    it('detalle, alta, edición, restauración e imagen responden ETag con el updatedAt', async () => {
      const created = await api()
        .post('/api/books')
        .set('Cookie', cookie)
        .send({
          title: 'Libro versionado',
          authorName: 'Autor e2e',
          publisherName: 'Editorial e2e',
          genreName: 'Género e2e',
          price: 1000,
          stock: 1,
        })
        .expect(201);
      const book = created.body.data as BookBody;
      expect(created.headers.etag).toBe(etagOf(book));

      const detail = await api()
        .get(`/api/books/${book.id}`)
        .set('Cookie', cookie)
        .expect(200);
      expect(detail.headers.etag).toBe(etagOf(detail.body.data));

      const patched = await api()
        .patch(`/api/books/${book.id}`)
        .set('Cookie', cookie)
        .send({ stock: 4 })
        .expect(200);
      expect(patched.headers.etag).toBe(etagOf(patched.body.data));
      expect(patched.headers.etag).not.toBe(created.headers.etag);

      const image = await api()
        .post(`/api/books/${book.id}/image`)
        .set('Cookie', cookie)
        .attach('image', JPEG_BYTES, 'portada.jpg')
        .expect(200);
      expect(image.headers.etag).toBe(etagOf(image.body.data));

      await api()
        .delete(`/api/books/${book.id}`)
        .set('Cookie', cookie)
        .expect(204);
      const restored = await api()
        .post(`/api/books/${book.id}/restore`)
        .set('Cookie', cookie)
        .expect(200);
      expect(restored.headers.etag).toBe(etagOf(restored.body.data));
    });

    it('PATCH con If-Match vigente actualiza; con uno obsoleto responde 412 sin cambiar ni auditar', async () => {
      const book = await createBook({ stock: 1 });
      const first = await api()
        .patch(`/api/books/${book.id}`)
        .set('Cookie', cookie)
        .set('If-Match', etagOf(book))
        .send({ stock: 2 })
        .expect(200);
      expect(first.body.data.stock).toBe(2);
      const auditsBefore = await auditTotal(book.id);

      // Otra persona editó con la versión que ya no es la vigente.
      const { body } = await api()
        .patch(`/api/books/${book.id}`)
        .set('Cookie', cookie)
        .set('If-Match', etagOf(book))
        .send({ stock: 9 })
        .expect(412);

      expect(body).toMatchObject({
        statusCode: 412,
        error: 'Precondition Failed',
        message: BOOK_MODIFIED,
        path: `/api/books/${book.id}`,
        requestId: expect.any(String),
      });
      const current = await api()
        .get(`/api/books/${book.id}`)
        .set('Cookie', cookie)
        .expect(200);
      expect(current.body.data.stock).toBe(2);
      expect(current.body.data.updatedAt).toBe(first.body.data.updatedAt);
      await expect(auditTotal(book.id)).resolves.toBe(auditsBefore);
    });

    it('PATCH sin If-Match sigue funcionando (gana la última escritura)', async () => {
      const book = await createBook({ stock: 1 });
      await api()
        .patch(`/api/books/${book.id}`)
        .set('Cookie', cookie)
        .send({ stock: 2 })
        .expect(200);
      const { body } = await api()
        .patch(`/api/books/${book.id}`)
        .set('Cookie', cookie)
        .send({ stock: 3 })
        .expect(200);
      expect(body.data.stock).toBe(3);
    });

    it('PATCH sin cambios efectivos responde 200 sin tocar updatedAt ni auditar', async () => {
      const book = await createBook({ title: 'Sin cambios', stock: 5 });
      const auditsBefore = await auditTotal(book.id);

      const response = await api()
        .patch(`/api/books/${book.id}`)
        .set('Cookie', cookie)
        .set('If-Match', etagOf(book))
        .send({ title: 'Sin cambios', stock: 5, price: 1000 })
        .expect(200);

      expect(response.body.data.updatedAt).toBe(book.updatedAt);
      expect(response.headers.etag).toBe(etagOf(book));
      await expect(auditTotal(book.id)).resolves.toBe(auditsBefore);
    });

    it('PATCH con If-Match sobre un libro eliminado responde 404', async () => {
      const book = await createBook();
      await api()
        .delete(`/api/books/${book.id}`)
        .set('Cookie', cookie)
        .expect(204);
      await api()
        .patch(`/api/books/${book.id}`)
        .set('Cookie', cookie)
        .set('If-Match', etagOf(book))
        .send({ stock: 3 })
        .expect(404);
    });

    it('dos ediciones simultáneas con la misma versión: una gana y la otra recibe 412', async () => {
      const book = await createBook({ stock: 1 });
      const responses = await Promise.all(
        [7, 8].map((stock) =>
          api()
            .patch(`/api/books/${book.id}`)
            .set('Cookie', cookie)
            .set('If-Match', etagOf(book))
            .send({ stock }),
        ),
      );
      expect(responses.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        200, 412,
      ]);
      const winner = responses.find((r) => r.status === 200)!;
      const { body } = await api()
        .get(`/api/books/${book.id}`)
        .set('Cookie', cookie)
        .expect(200);
      expect(body.data.stock).toBe(winner.body.data.stock);
      await expect(auditTotal(book.id)).resolves.toBe(2);
    });

    it('imagen con If-Match obsoleto responde 412: la portada anterior se conserva y no queda archivo nuevo', async () => {
      const book = await createBook();
      const withCover = await api()
        .post(`/api/books/${book.id}/image`)
        .set('Cookie', cookie)
        .attach('image', JPEG_BYTES, 'portada.jpg')
        .expect(200);
      const seen = withCover.body.data as BookBody;
      // Otra persona cambia el título después de que se abrió la edición.
      const changed = await api()
        .patch(`/api/books/${book.id}`)
        .set('Cookie', cookie)
        .send({ title: 'Título cambiado por otra persona' })
        .expect(200);
      const uploadsDir = process.env.UPLOADS_DIR ?? '';
      const filesBefore = readdirSync(uploadsDir).sort();
      const auditsBefore = await auditTotal(book.id);

      const { body } = await api()
        .post(`/api/books/${book.id}/image`)
        .set('Cookie', cookie)
        .set('If-Match', etagOf(seen))
        .attach('image', PNG_BYTES, 'portada.png')
        .expect(412);

      expect(body).toMatchObject({ statusCode: 412, message: BOOK_MODIFIED });
      const current = await api()
        .get(`/api/books/${book.id}`)
        .set('Cookie', cookie)
        .expect(200);
      expect(current.body.data.imageUrl).toBe(seen.imageUrl);
      expect(current.body.data.updatedAt).toBe(changed.body.data.updatedAt);
      await api().get(seen.imageUrl!).expect(200);
      expect(readdirSync(uploadsDir).sort()).toEqual(filesBefore);
      await expect(auditTotal(book.id)).resolves.toBe(auditsBefore);
    });

    it('imagen con If-Match vigente responde 200 con una versión y un ETag nuevos', async () => {
      const book = await createBook();

      const response = await api()
        .post(`/api/books/${book.id}/image`)
        .set('Cookie', cookie)
        .set('If-Match', etagOf(book))
        .attach('image', JPEG_BYTES, 'portada.jpg')
        .expect(200);

      const updated = response.body.data as BookBody;
      expect(updated.imageUrl).toMatch(/\.jpg$/);
      expect(updated.updatedAt > book.updatedAt).toBe(true);
      expect(response.headers.etag).toBe(etagOf(updated));
      expect(response.headers.etag).not.toBe(etagOf(book));
    });

    it('CORS expone ETag y Swagger documenta If-Match y el 412', async () => {
      const book = await createBook();
      const response = await api()
        .get(`/api/books/${book.id}`)
        .set('Cookie', cookie)
        .set('Origin', 'http://localhost:5173')
        .expect(200);
      expect(response.headers['access-control-expose-headers']).toBe('ETag');

      const { body } = await api().get('/api/docs/openapi.json').expect(200);
      const patch = body.paths['/api/books/{id}'].patch;
      expect(patch.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'If-Match',
            in: 'header',
            required: false,
          }),
        ]),
      );
      expect(patch.responses['412']).toBeDefined();
      expect(patch.responses['200'].headers.ETag).toBeDefined();
      const image = body.paths['/api/books/{id}/image'].post;
      expect(image.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'If-Match', in: 'header' }),
        ]),
      );
      expect(image.responses['412']).toBeDefined();
    });
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
    it('entrega CSV para Excel es-CL: BOM, ";" como separador, coma decimal y los libros filtrados', async () => {
      await createBook({
        title: 'Exportable; con "comillas", y coma',
        price: 15990.5,
        stock: 0,
      });
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
      expect(lines[1]).toContain('"Exportable; con ""comillas"", y coma"');
      const fields = lines[1].split(';');
      expect(fields.slice(-4, -1)).toEqual(['15990,50', '0', 'No']);
      expect(fields.at(-1)).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it('si la base falla al comenzar responde 500 con el formato de error, sin filtrar el detalle', async () => {
      vi.spyOn(ctx.app.get(BooksRepository), 'findBatch').mockRejectedValueOnce(
        new Error('detalle interno de la conexión'),
      );

      const response = await api()
        .get('/api/books/export')
        .set('Cookie', cookie)
        .expect(500);

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Error interno del servidor',
        path: '/api/books/export',
        requestId: expect.any(String),
      });
      expect(response.text).not.toContain('detalle interno');
    });

    it('si la base falla a mitad del stream la descarga se corta (no queda un CSV truncado "completo")', async () => {
      const firstBatch = Array.from({ length: EXPORT_BATCH_SIZE }, (_, index) =>
        makeBook({
          id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        }),
      );
      vi.spyOn(ctx.app.get(BooksRepository), 'findBatch')
        .mockResolvedValueOnce(firstBatch)
        .mockRejectedValueOnce(new Error('conexión perdida'));

      // La conexión se corta: el cliente recibe un error de red, no un 200 terminado.
      await expect(
        api().get('/api/books/export').set('Cookie', cookie).buffer(true),
      ).rejects.toThrow(/aborted|socket hang up|ECONNRESET/);
    });
  });
});
