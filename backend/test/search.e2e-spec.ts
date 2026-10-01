import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createE2eApp, login, type E2eApp } from './support/e2e-app.js';

interface BookBody {
  id: string;
  title: string;
  author: { name: string };
}

describe('Búsqueda sin distinguir tildes ni mayúsculas (e2e)', () => {
  let ctx: E2eApp;
  let cookie: string;
  let cienAnos: BookBody;
  let coronel: BookBody;
  let viejo: BookBody;
  let sinTilde: BookBody;
  let nino: BookBody;

  const api = () => request(ctx.server);

  async function createBook(title: string, authorName: string) {
    const { body } = await api()
      .post('/api/books')
      .set('Cookie', cookie)
      .send({
        title,
        authorName,
        publisherName: 'Editorial búsqueda',
        genreName: 'Novela',
        price: 1000,
        stock: 1,
      })
      .expect(201);
    return body.data as BookBody;
  }

  async function listIds(search: string): Promise<string[]> {
    const { body } = await api()
      .get('/api/books')
      .query({ search, limit: 100 })
      .set('Cookie', cookie)
      .expect(200);
    return (body.data as BookBody[]).map((book) => book.id).sort();
  }

  async function trashIds(search: string): Promise<string[]> {
    const { body } = await api()
      .get('/api/books/trash')
      .query({ search, limit: 100 })
      .set('Cookie', cookie)
      .expect(200);
    return (body.data as BookBody[]).map((book) => book.id).sort();
  }

  const ids = (...books: BookBody[]) => books.map((book) => book.id).sort();

  beforeAll(async () => {
    ctx = await createE2eApp();
    cookie = await login(ctx.server, ctx.credentials);
    cienAnos = await createBook(
      'Cien años de soledad',
      'Gabriel García Márquez',
    );
    coronel = await createBook(
      'El coronel no tiene quien le escriba',
      'Gabriel García Márquez',
    );
    viejo = await createBook(
      'Un viejo que leía novelas de amor',
      'Luis Sepúlveda',
    );
    sinTilde = await createBook('Cuentos del sur', 'Ana Garcia');
    nino = await createBook('El niño con el pijama de rayas', 'John Boyne');
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('search=garcia encuentra a "García Márquez" (y a "Garcia")', async () => {
    expect(await listIds('garcia')).toEqual(ids(cienAnos, coronel, sinTilde));
  });

  it('search=SEPULVEDA encuentra a Sepúlveda', async () => {
    expect(await listIds('SEPULVEDA')).toEqual(ids(viejo));
  });

  it('buscar con tilde también encuentra el texto sin tilde', async () => {
    expect(await listIds('García')).toEqual(ids(cienAnos, coronel, sinTilde));
    expect(await listIds('GARCÍA MÁRQUEZ')).toEqual(ids(cienAnos, coronel));
  });

  it('busca en el título sin tildes; "ñ" y "n" son equivalentes', async () => {
    expect(await listIds('cien anos')).toEqual(ids(cienAnos));
    expect(await listIds('leia novelas')).toEqual(ids(viejo));
    expect(await listIds('nino')).toEqual(ids(nino));
    expect(await listIds('NIÑO')).toEqual(ids(nino));
  });

  it('la edición actualiza la búsqueda de título y autor', async () => {
    const book = await createBook('Libro editable', 'Autora original');
    await api()
      .patch(`/api/books/${book.id}`)
      .set('Cookie', cookie)
      .send({ title: 'Árbol de Diana', authorName: 'Alejandra Pizarnik' })
      .expect(200);

    expect(await listIds('arbol')).toEqual(ids(book));
    expect(await listIds('pizarnik')).toEqual(ids(book));
    expect(await listIds('autora original')).toEqual([]);
    expect(await listIds('editable')).toEqual([]);
  });

  it('la exportación CSV con search=garcia incluye esos libros', async () => {
    const response = await api()
      .get('/api/books/export')
      .query({ search: 'garcia' })
      .set('Cookie', cookie)
      .buffer(true)
      .expect(200);
    const rows = response.text.trim().split('\n').slice(1);
    expect(rows).toHaveLength(3);
    for (const book of [cienAnos, coronel, sinTilde]) {
      expect(response.text).toContain(book.id);
    }
    expect(response.text).toContain('Gabriel García Márquez');
  });

  it('la papelera también busca sin tildes', async () => {
    await api()
      .delete(`/api/books/${coronel.id}`)
      .set('Cookie', cookie)
      .expect(204);
    await api()
      .delete(`/api/books/${viejo.id}`)
      .set('Cookie', cookie)
      .expect(204);

    expect(await trashIds('garcia')).toEqual(ids(coronel));
    expect(await trashIds('sepulveda')).toEqual(ids(viejo));
    expect(await listIds('garcia')).toEqual(ids(cienAnos, sinTilde));
  });
});
