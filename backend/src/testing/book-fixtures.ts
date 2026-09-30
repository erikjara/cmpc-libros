import { Prisma } from '../generated/prisma/client.js';
import type { BookWithRelations } from '../books/books.repository.js';

export const BOOK_ID = '3f2b8a54-5f0e-4f7c-9a57-3a5f9b2f6e10';
const CATALOG_DATE = new Date('2026-08-01T00:00:00.000Z');

export function makeBook(
  overrides: Partial<BookWithRelations> = {},
): BookWithRelations {
  return {
    id: BOOK_ID,
    title: 'La casa de los espíritus',
    authorId: 'a1',
    publisherId: 'p1',
    genreId: 'g1',
    price: new Prisma.Decimal('15990.50'),
    stock: 3,
    imageKey: null,
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    updatedAt: new Date('2026-09-02T10:00:00.000Z'),
    deletedAt: null,
    author: { id: 'a1', name: 'Isabel Allende', createdAt: CATALOG_DATE },
    publisher: { id: 'p1', name: 'Sudamericana', createdAt: CATALOG_DATE },
    genre: { id: 'g1', name: 'Realismo mágico', createdAt: CATALOG_DATE },
    ...overrides,
  };
}

export const BOOK_INPUT = {
  title: 'La casa de los espíritus',
  authorName: 'Isabel Allende',
  publisherName: 'Sudamericana',
  genreName: 'Realismo mágico',
  price: 15990.5,
  stock: 3,
};

export const REQUEST_CONTEXT = {
  userId: 'u1',
  ip: '10.0.0.1',
  userAgent: 'vitest',
};
