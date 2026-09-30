import type { BookWithRelations } from './books.repository.js';

export interface CatalogItem {
  id: string;
  name: string;
}

export interface BookDto {
  id: string;
  title: string;
  author: CatalogItem;
  publisher: CatalogItem;
  genre: CatalogItem;
  price: number;
  stock: number;
  available: boolean;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export const UPLOADS_URL_PREFIX = '/api/uploads';

export function toBookDto(book: BookWithRelations): BookDto {
  return {
    id: book.id,
    title: book.title,
    author: { id: book.author.id, name: book.author.name },
    publisher: { id: book.publisher.id, name: book.publisher.name },
    genre: { id: book.genre.id, name: book.genre.name },
    price: book.price.toNumber(),
    stock: book.stock,
    available: book.stock > 0,
    imageUrl: book.imageKey ? `${UPLOADS_URL_PREFIX}/${book.imageKey}` : null,
    createdAt: book.createdAt.toISOString(),
    updatedAt: book.updatedAt.toISOString(),
  };
}
