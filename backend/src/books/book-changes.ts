import type { BookInput, BookWithRelations } from './books.repository.js';

/** Indica si algún campo enviado difiere del valor guardado (precio a 2 decimales). */
export function hasEffectiveChanges(
  current: BookWithRelations,
  input: Partial<BookInput>,
): boolean {
  return (
    (input.title !== undefined && input.title !== current.title) ||
    (input.authorName !== undefined &&
      input.authorName !== current.author.name) ||
    (input.publisherName !== undefined &&
      input.publisherName !== current.publisher.name) ||
    (input.genreName !== undefined && input.genreName !== current.genre.name) ||
    (input.price !== undefined &&
      !current.price.equals(input.price.toFixed(2))) ||
    (input.stock !== undefined && input.stock !== current.stock)
  );
}
