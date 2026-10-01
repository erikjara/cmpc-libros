import type { BookInput, BookWithRelations } from './books.repository.js';

/** Autor, editorial y género se identifican por nombre sin distinguir mayúsculas. */
function differsInCatalogName(
  input: string | undefined,
  current: string,
): boolean {
  return input !== undefined && input.toLowerCase() !== current.toLowerCase();
}

/**
 * Indica si algún campo enviado difiere del valor guardado (precio a 2 decimales; nombres
 * de catálogo sin distinguir mayúsculas, porque apuntan al mismo registro).
 */
export function hasEffectiveChanges(
  current: BookWithRelations,
  input: Partial<BookInput>,
): boolean {
  return (
    (input.title !== undefined && input.title !== current.title) ||
    differsInCatalogName(input.authorName, current.author.name) ||
    differsInCatalogName(input.publisherName, current.publisher.name) ||
    differsInCatalogName(input.genreName, current.genre.name) ||
    (input.price !== undefined &&
      !current.price.equals(input.price.toFixed(2))) ||
    (input.stock !== undefined && input.stock !== current.stock)
  );
}
