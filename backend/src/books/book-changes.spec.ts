import { describe, expect, it } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { BOOK_INPUT, makeBook } from '../testing/book-fixtures.js';
import { hasEffectiveChanges } from './book-changes.js';

describe('hasEffectiveChanges', () => {
  it('es false si todos los valores enviados son iguales a los actuales', () => {
    expect(hasEffectiveChanges(makeBook(), BOOK_INPUT)).toBe(false);
    expect(hasEffectiveChanges(makeBook(), { stock: 3 })).toBe(false);
  });

  it('compara el precio como decimal de 2 posiciones', () => {
    const book = makeBook({ price: new Prisma.Decimal('15990.50') });
    expect(hasEffectiveChanges(book, { price: 15990.5 })).toBe(false);
    expect(hasEffectiveChanges(book, { price: 15990.51 })).toBe(true);
  });

  it.each([
    { title: 'Otro título' },
    { authorName: 'Otro autor' },
    { publisherName: 'Otra editorial' },
    { genreName: 'Otro género' },
    { price: 1 },
    { stock: 0 },
  ])('es true si cambia %o', (input) => {
    expect(hasEffectiveChanges(makeBook(), input)).toBe(true);
  });

  it('distingue mayúsculas en los nombres de catálogo', () => {
    expect(
      hasEffectiveChanges(makeBook(), { authorName: 'isabel allende' }),
    ).toBe(true);
  });
});
