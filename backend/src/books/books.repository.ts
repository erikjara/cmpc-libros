import { Injectable } from '@nestjs/common';
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

function connectOrCreateByName(name: string) {
  return { connectOrCreate: { where: { name }, create: { name } } };
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

  create(db: DbClient, input: BookInput): Promise<BookWithRelations> {
    return db.book.create({
      data: {
        title: input.title,
        price: toDecimal(input.price),
        stock: input.stock,
        author: connectOrCreateByName(input.authorName),
        publisher: connectOrCreateByName(input.publisherName),
        genre: connectOrCreateByName(input.genreName),
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

  update(
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
      data.author = connectOrCreateByName(input.authorName);
    if (input.publisherName !== undefined)
      data.publisher = connectOrCreateByName(input.publisherName);
    if (input.genreName !== undefined)
      data.genre = connectOrCreateByName(input.genreName);
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
