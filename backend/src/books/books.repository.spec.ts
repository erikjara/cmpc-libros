import { beforeEach, describe, expect, it } from 'vitest';
import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { BOOK_ID, BOOK_INPUT, makeBook } from '../testing/book-fixtures.js';
import {
  BOOK_INCLUDE,
  BooksRepository,
  TRASH_ORDER_BY,
} from './books.repository.js';

describe('BooksRepository', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let tx: DeepMockProxy<Prisma.TransactionClient>;
  let repository: BooksRepository;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    tx = mockDeep<Prisma.TransactionClient>();
    repository = new BooksRepository(prisma);
  });

  it('findPage consulta página y total en una misma transacción', async () => {
    prisma.$transaction.mockResolvedValue([[makeBook()], 1] as never);
    const query = {
      where: { deletedAt: null },
      orderBy: [{ id: 'asc' as const }],
      skip: 0,
      take: 10,
    };

    await expect(repository.findPage(query)).resolves.toEqual([
      [makeBook()],
      1,
    ]);
    expect(prisma.book.findMany).toHaveBeenCalledWith({
      ...query,
      include: BOOK_INCLUDE,
    });
    expect(prisma.book.count).toHaveBeenCalledWith({ where: query.where });
  });

  describe('findTrashPage', () => {
    const deleted = makeBook({ deletedAt: new Date('2026-09-20T10:00:00Z') });

    it('consulta solo eliminados, del más reciente al más antiguo y desempatando por id', async () => {
      prisma.$transaction.mockResolvedValue([[deleted], 1] as never);

      await expect(
        repository.findTrashPage({ skip: 10, take: 10 }),
      ).resolves.toEqual([[deleted], 1]);

      const where = { deletedAt: { not: null } };
      expect(TRASH_ORDER_BY).toEqual([{ deletedAt: 'desc' }, { id: 'asc' }]);
      expect(prisma.book.findMany).toHaveBeenCalledWith({
        where,
        orderBy: TRASH_ORDER_BY,
        skip: 10,
        take: 10,
        include: BOOK_INCLUDE,
      });
      expect(prisma.book.count).toHaveBeenCalledWith({ where });
    });

    it('busca en título y autor con los comodines escapados', async () => {
      prisma.$transaction.mockResolvedValue([[], 0] as never);

      await repository.findTrashPage({ search: '100%', skip: 0, take: 10 });

      const where = {
        deletedAt: { not: null },
        OR: [
          { title: { contains: '100\\%', mode: 'insensitive' } },
          { author: { name: { contains: '100\\%', mode: 'insensitive' } } },
        ],
      };
      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where }),
      );
      expect(prisma.book.count).toHaveBeenCalledWith({ where });
    });
  });

  it('findBatch sin cursor pide el primer lote', async () => {
    prisma.book.findMany.mockResolvedValue([]);
    await repository.findBatch({
      where: {},
      orderBy: [{ id: 'asc' }],
      take: 500,
    });
    expect(prisma.book.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ id: 'asc' }],
      take: 500,
      include: BOOK_INCLUDE,
    });
  });

  it('findBatch con cursor salta el último registro leído', async () => {
    prisma.book.findMany.mockResolvedValue([]);
    await repository.findBatch({
      where: {},
      orderBy: [{ id: 'asc' }],
      take: 500,
      cursor: 'last',
    });
    expect(prisma.book.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'last' }, skip: 1 }),
    );
  });

  it('findActiveById filtra deletedAt: null y usa el cliente recibido', async () => {
    tx.book.findFirst.mockResolvedValue(null);
    await repository.findActiveById(BOOK_ID, tx);
    expect(tx.book.findFirst).toHaveBeenCalledWith({
      where: { id: BOOK_ID, deletedAt: null },
      include: BOOK_INCLUDE,
    });
    expect(prisma.book.findFirst).not.toHaveBeenCalled();
  });

  it('findActiveById usa PrismaService por defecto', async () => {
    prisma.book.findFirst.mockResolvedValue(makeBook());
    await expect(repository.findActiveById(BOOK_ID)).resolves.toEqual(
      makeBook(),
    );
  });

  it('findAnyById incluye eliminados', async () => {
    tx.book.findUnique.mockResolvedValue(null);
    await repository.findAnyById(BOOK_ID, tx);
    expect(tx.book.findUnique).toHaveBeenCalledWith({
      where: { id: BOOK_ID },
      include: BOOK_INCLUDE,
    });
  });

  describe('autor, editorial y género por nombre sin distinguir mayúsculas', () => {
    /** SQL (sin parámetros) y valores de cada búsqueda por nombre. */
    function lookups() {
      return tx.$queryRaw.mock.calls.map(([strings, ...values]) => ({
        sql: (strings as TemplateStringsArray).join('?').replace(/\s+/g, ' '),
        values,
      }));
    }

    it('create conecta por id con los registros existentes, sin crear nuevos', async () => {
      tx.$queryRaw
        .mockResolvedValueOnce([{ id: 'a1' }])
        .mockResolvedValueOnce([{ id: 'p1' }])
        .mockResolvedValueOnce([{ id: 'g1' }]);
      tx.book.create.mockResolvedValue(makeBook());

      await repository.create(tx, {
        ...BOOK_INPUT,
        authorName: 'ISABEL allende',
      });

      expect(lookups()).toEqual([
        {
          sql: ' SELECT id FROM authors WHERE lower(name) = lower(?) LIMIT 1',
          values: ['ISABEL allende'],
        },
        {
          sql: ' SELECT id FROM publishers WHERE lower(name) = lower(?) LIMIT 1',
          values: ['Sudamericana'],
        },
        {
          sql: ' SELECT id FROM genres WHERE lower(name) = lower(?) LIMIT 1',
          values: ['Realismo mágico'],
        },
      ]);
      const args = tx.book.create.mock.calls[0][0];
      expect(args.data.author).toEqual({ connect: { id: 'a1' } });
      expect(args.data.publisher).toEqual({ connect: { id: 'p1' } });
      expect(args.data.genre).toEqual({ connect: { id: 'g1' } });
      expect(tx.author.create).not.toHaveBeenCalled();
      expect(tx.publisher.create).not.toHaveBeenCalled();
      expect(tx.genre.create).not.toHaveBeenCalled();
    });

    it('create crea los que no existen con el nombre recibido y guarda el precio como Decimal', async () => {
      tx.$queryRaw.mockResolvedValue([]);
      tx.author.create.mockResolvedValue({ id: 'a2' } as never);
      tx.publisher.create.mockResolvedValue({ id: 'p2' } as never);
      tx.genre.create.mockResolvedValue({ id: 'g2' } as never);
      tx.book.create.mockResolvedValue(makeBook());

      await repository.create(tx, BOOK_INPUT);

      const select = { id: true };
      expect(tx.author.create).toHaveBeenCalledWith({
        data: { name: 'Isabel Allende' },
        select,
      });
      expect(tx.publisher.create).toHaveBeenCalledWith({
        data: { name: 'Sudamericana' },
        select,
      });
      expect(tx.genre.create).toHaveBeenCalledWith({
        data: { name: 'Realismo mágico' },
        select,
      });
      const args = tx.book.create.mock.calls[0][0];
      expect(args.data.author).toEqual({ connect: { id: 'a2' } });
      expect(args.data.publisher).toEqual({ connect: { id: 'p2' } });
      expect(args.data.genre).toEqual({ connect: { id: 'g2' } });
      expect(args.data.price).toBeInstanceOf(Prisma.Decimal);
      expect((args.data.price as Prisma.Decimal).toFixed(2)).toBe('15990.50');
      expect(args.include).toEqual(BOOK_INCLUDE);
    });

    it('trata % y _ como caracteres literales (no usa ILIKE)', async () => {
      tx.$queryRaw.mockResolvedValue([]);
      tx.author.create.mockResolvedValue({ id: 'a3' } as never);
      tx.book.update.mockResolvedValue(makeBook());

      await repository.update(tx, BOOK_ID, { authorName: 'Autor_100%' });

      expect(lookups()).toEqual([
        {
          sql: ' SELECT id FROM authors WHERE lower(name) = lower(?) LIMIT 1',
          values: ['Autor_100%'],
        },
      ]);
    });
  });

  it('lockIfUnchanged escribe la nueva versión solo si id, deletedAt y updatedAt coinciden', async () => {
    const expected = new Date('2026-09-02T10:00:00.000Z');
    const version = new Date('2026-09-03T10:00:00.000Z');
    tx.book.updateMany.mockResolvedValueOnce({ count: 1 });

    await expect(
      repository.lockIfUnchanged(tx, BOOK_ID, expected, version),
    ).resolves.toBe(true);
    expect(tx.book.updateMany).toHaveBeenCalledWith({
      where: { id: BOOK_ID, deletedAt: null, updatedAt: expected },
      data: { updatedAt: version },
    });

    tx.book.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      repository.lockIfUnchanged(tx, BOOK_ID, expected, version),
    ).resolves.toBe(false);
  });

  it('update fija updatedAt si recibe la versión', async () => {
    const version = new Date('2026-09-03T10:00:00.000Z');
    tx.book.update.mockResolvedValue(makeBook());
    await repository.update(tx, BOOK_ID, { stock: 1 }, version);
    expect(tx.book.update.mock.calls[0][0].data).toEqual({
      stock: 1,
      updatedAt: version,
    });
  });

  it('update solo envía los campos presentes', async () => {
    tx.$queryRaw.mockResolvedValue([{ id: 'g9' }]);
    tx.book.update.mockResolvedValue(makeBook());
    await repository.update(tx, BOOK_ID, { stock: 0, genreName: 'novela' });
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.book.update).toHaveBeenCalledWith({
      where: { id: BOOK_ID },
      data: { stock: 0, genre: { connect: { id: 'g9' } } },
      include: BOOK_INCLUDE,
    });
  });

  it('update convierte todos los campos cuando vienen completos', async () => {
    tx.$queryRaw.mockResolvedValue([]);
    tx.author.create.mockResolvedValue({ id: 'a1' } as never);
    tx.publisher.create.mockResolvedValue({ id: 'p1' } as never);
    tx.genre.create.mockResolvedValue({ id: 'g1' } as never);
    tx.book.update.mockResolvedValue(makeBook());
    await repository.update(tx, BOOK_ID, BOOK_INPUT);
    const { data } = tx.book.update.mock.calls[0][0];
    expect(Object.keys(data).sort()).toEqual(
      ['author', 'genre', 'price', 'publisher', 'stock', 'title'].sort(),
    );
  });

  it('softDelete marca deletedAt, restore lo limpia y setImageKey guarda la clave', async () => {
    tx.book.update.mockResolvedValue(makeBook());

    await repository.softDelete(tx, BOOK_ID);
    expect(tx.book.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);

    await repository.restore(tx, BOOK_ID);
    expect(tx.book.update.mock.calls[1][0].data).toEqual({ deletedAt: null });

    await repository.setImageKey(tx, BOOK_ID, 'k.png');
    expect(tx.book.update.mock.calls[2][0].data).toEqual({ imageKey: 'k.png' });
  });
});
