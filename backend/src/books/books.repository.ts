import { Injectable } from '@nestjs/common';
import type { CatalogKind } from '../catalog/catalog.repository.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DbClient } from '../prisma/prisma.types.js';
import { searchCondition } from './book-query.js';

export const BOOK_INCLUDE = {
  author: true,
  publisher: true,
  genre: true,
} satisfies Prisma.BookInclude;

export type BookWithRelations = Prisma.BookGetPayload<{
  include: typeof BOOK_INCLUDE;
}>;

export interface BookInput {
  title: string;
  authorName: string;
  publisherName: string;
  genreName: string;
  price: number;
  stock: number;
}

export interface BookPageQuery {
  where: Prisma.BookWhereInput;
  orderBy: Prisma.BookOrderByWithRelationInput[];
  skip: number;
  take: number;
}

/** Libro eliminado lógicamente: `deletedAt` siempre presente. */
export type TrashedBookWithRelations = BookWithRelations & { deletedAt: Date };

export interface TrashPageQuery {
  search?: string;
  skip: number;
  take: number;
}

/** Papelera: eliminación más reciente primero; `id` desempata para paginar de forma estable. */
export const TRASH_ORDER_BY = [
  { deletedAt: 'desc' },
  { id: 'asc' },
] satisfies Prisma.BookOrderByWithRelationInput[];

export interface BookBatchQuery {
  where: Prisma.BookWhereInput;
  orderBy: Prisma.BookOrderByWithRelationInput[];
  take: number;
  cursor?: string;
}

/**
 * Id del autor, editorial o género cuyo nombre coincide sin distinguir mayúsculas. Usa
 * `lower(name) =` (y no ILIKE) para que `%` y `_` sean literales y la consulta use el
 * índice único `<tabla>_name_lower_key`.
 */
async function findCatalogIdByName(
  db: DbClient,
  kind: CatalogKind,
  name: string,
): Promise<string | null> {
  let rows: { id: string }[];
  switch (kind) {
    case 'author':
      rows = await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM authors WHERE lower(name) = lower(${name}) LIMIT 1`;
      break;
    case 'publisher':
      rows = await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM publishers WHERE lower(name) = lower(${name}) LIMIT 1`;
      break;
    case 'genre':
      rows = await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM genres WHERE lower(name) = lower(${name}) LIMIT 1`;
      break;
  }
  return rows[0]?.id ?? null;
}

/**
 * Conecta con el registro existente aunque difiera en mayúsculas (conserva el nombre tal
 * como está guardado) o lo crea. Si otra transacción crea a la vez el mismo nombre, el
 * índice único sobre lower(name) hace fallar el INSERT con P2002 y el service reintenta.
 */
async function connectOrCreateByName(
  db: DbClient,
  kind: CatalogKind,
  name: string,
): Promise<{ connect: { id: string } }> {
  const existing = await findCatalogIdByName(db, kind, name);
  if (existing) {
    return { connect: { id: existing } };
  }
  const args = { data: { name }, select: { id: true } };
  const { id } =
    kind === 'author'
      ? await db.author.create(args)
      : kind === 'publisher'
        ? await db.publisher.create(args)
        : await db.genre.create(args);
  return { connect: { id } };
}

function toDecimal(price: number): Prisma.Decimal {
  return new Prisma.Decimal(price.toFixed(2));
}

@Injectable()
export class BooksRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPage(query: BookPageQuery): Promise<[BookWithRelations[], number]> {
    return this.prisma.$transaction([
      this.prisma.book.findMany({ ...query, include: BOOK_INCLUDE }),
      this.prisma.book.count({ where: query.where }),
    ]);
  }

  async findTrashPage(
    query: TrashPageQuery,
  ): Promise<[TrashedBookWithRelations[], number]> {
    const where: Prisma.BookWhereInput = {
      deletedAt: { not: null },
      ...searchCondition(query.search),
    };
    const [books, total] = await this.prisma.$transaction([
      this.prisma.book.findMany({
        where,
        orderBy: TRASH_ORDER_BY,
        skip: query.skip,
        take: query.take,
        include: BOOK_INCLUDE,
      }),
      this.prisma.book.count({ where }),
    ]);
    // El filtro `deletedAt: { not: null }` garantiza la fecha de eliminación.
    return [books as TrashedBookWithRelations[], total];
  }

  /** Lote para exportación: paginación por cursor sobre el mismo orden del listado. */
  findBatch(query: BookBatchQuery): Promise<BookWithRelations[]> {
    return this.prisma.book.findMany({
      where: query.where,
      orderBy: query.orderBy,
      take: query.take,
      include: BOOK_INCLUDE,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
  }

  findActiveById(
    id: string,
    db: DbClient = this.prisma,
  ): Promise<BookWithRelations | null> {
    return db.book.findFirst({
      where: { id, deletedAt: null },
      include: BOOK_INCLUDE,
    });
  }

  /** Incluye libros eliminados (para restaurar). */
  findAnyById(
    id: string,
    db: DbClient = this.prisma,
  ): Promise<BookWithRelations | null> {
    return db.book.findUnique({ where: { id }, include: BOOK_INCLUDE });
  }

  /** Las consultas van en secuencia: dentro de una transacción comparten conexión. */
  async create(db: DbClient, input: BookInput): Promise<BookWithRelations> {
    const author = await connectOrCreateByName(db, 'author', input.authorName);
    const publisher = await connectOrCreateByName(
      db,
      'publisher',
      input.publisherName,
    );
    const genre = await connectOrCreateByName(db, 'genre', input.genreName);
    return db.book.create({
      data: {
        title: input.title,
        price: toDecimal(input.price),
        stock: input.stock,
        author,
        publisher,
        genre,
      },
      include: BOOK_INCLUDE,
    });
  }

  /**
   * Update condicional para bloqueo optimista: escribe `version` en `updatedAt` solo si
   * el libro sigue activo y con la versión leída. Si otra transacción lo modificó, no
   * actualiza ninguna fila (`false`); si no, la fila queda bloqueada hasta el commit.
   */
  async lockIfUnchanged(
    db: DbClient,
    id: string,
    expectedUpdatedAt: Date,
    version: Date,
  ): Promise<boolean> {
    const { count } = await db.book.updateMany({
      where: { id, deletedAt: null, updatedAt: expectedUpdatedAt },
      data: { updatedAt: version },
    });
    return count === 1;
  }

  async update(
    db: DbClient,
    id: string,
    input: Partial<BookInput>,
    version?: Date,
  ): Promise<BookWithRelations> {
    const data: Prisma.BookUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.price !== undefined) data.price = toDecimal(input.price);
    if (input.stock !== undefined) data.stock = input.stock;
    if (input.authorName !== undefined)
      data.author = await connectOrCreateByName(db, 'author', input.authorName);
    if (input.publisherName !== undefined)
      data.publisher = await connectOrCreateByName(
        db,
        'publisher',
        input.publisherName,
      );
    if (input.genreName !== undefined)
      data.genre = await connectOrCreateByName(db, 'genre', input.genreName);
    if (version) data.updatedAt = version;
    return db.book.update({ where: { id }, data, include: BOOK_INCLUDE });
  }

  softDelete(db: DbClient, id: string): Promise<BookWithRelations> {
    return db.book.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: BOOK_INCLUDE,
    });
  }

  restore(db: DbClient, id: string): Promise<BookWithRelations> {
    return db.book.update({
      where: { id },
      data: { deletedAt: null },
      include: BOOK_INCLUDE,
    });
  }

  setImageKey(
    db: DbClient,
    id: string,
    imageKey: string,
  ): Promise<BookWithRelations> {
    return db.book.update({
      where: { id },
      data: { imageKey },
      include: BOOK_INCLUDE,
    });
  }
}
