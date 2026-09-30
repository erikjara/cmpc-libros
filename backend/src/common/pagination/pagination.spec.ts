import { describe, expect, it } from 'vitest';
import { buildPaginationMeta, toSkipTake } from './pagination.js';

describe('buildPaginationMeta', () => {
  it('calcula totalPages redondeando hacia arriba', () => {
    expect(buildPaginationMeta(2, 10, 21)).toEqual({
      page: 2,
      limit: 10,
      total: 21,
      totalPages: 3,
    });
  });

  it('devuelve 0 páginas cuando no hay resultados', () => {
    expect(buildPaginationMeta(1, 10, 0).totalPages).toBe(0);
  });
});

describe('toSkipTake', () => {
  it('convierte página y límite en skip/take', () => {
    expect(toSkipTake(1, 10)).toEqual({ skip: 0, take: 10 });
    expect(toSkipTake(3, 25)).toEqual({ skip: 50, take: 25 });
  });
});
