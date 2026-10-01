import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  buildBookQuery,
  escapeLike,
  parseSort,
  SORT_PATTERN,
} from './book-query.js';

describe('parseSort', () => {
  it('usa createdAt:desc por defecto', () => {
    expect(parseSort()).toEqual([{ field: 'createdAt', direction: 'desc' }]);
    expect(parseSort('   ')).toEqual([
      { field: 'createdAt', direction: 'desc' },
    ]);
  });

  it('interpreta múltiples criterios en orden', () => {
    expect(parseSort('price:desc,title:asc')).toEqual([
      { field: 'price', direction: 'desc' },
      { field: 'title', direction: 'asc' },
    ]);
  });

  it('rechaza campos fuera de la lista blanca', () => {
    expect(() => parseSort('isbn:asc')).toThrow(BadRequestException);
    expect(() => parseSort('isbn:asc')).toThrow(
      'Criterio de orden inválido: "isbn:asc"',
    );
  });

  it('rechaza direcciones inválidas o segmentos mal formados', () => {
    expect(() => parseSort('price:up')).toThrow(BadRequestException);
    expect(() => parseSort('price')).toThrow(BadRequestException);
    expect(() => parseSort('price:asc:extra')).toThrow(BadRequestException);
    expect(() => parseSort('price:asc,')).toThrow(BadRequestException);
  });

  it('rechaza campos repetidos', () => {
    expect(() => parseSort('price:asc,price:desc')).toThrow(
      'Campo de orden repetido: "price"',
    );
  });
});

describe('SORT_PATTERN', () => {
  it('coincide con la expresión documentada de la API', () => {
    expect(SORT_PATTERN.source).toBe(
      '^(title|price|stock|createdAt|author|publisher|genre):(asc|desc)(,(title|price|stock|createdAt|author|publisher|genre):(asc|desc))*$',
    );
    expect(SORT_PATTERN.test('author:asc,genre:desc')).toBe(true);
    expect(SORT_PATTERN.test('author:ASC')).toBe(false);
  });
});

describe('escapeLike', () => {
  it('escapa %, _ y la barra invertida', () => {
    expect(escapeLike('100%_real\\')).toBe('100\\%\\_real\\\\');
    expect(escapeLike('allende')).toBe('allende');
  });
});

describe('buildBookQuery', () => {
  it('sin filtros excluye eliminados y ordena por createdAt desc + id', () => {
    expect(buildBookQuery({})).toEqual({
      where: { deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  });

  it('search busca en título y autor sin distinguir mayúsculas', () => {
    const { where } = buildBookQuery({ search: 'Allende' });
    expect(where.OR).toEqual([
      { title: { contains: 'Allende', mode: 'insensitive' } },
      { author: { name: { contains: 'Allende', mode: 'insensitive' } } },
    ]);
  });

  it('search con comodines los busca literalmente', () => {
    const { where } = buildBookQuery({ search: '50%' });
    expect(where.OR).toEqual([
      { title: { contains: '50\\%', mode: 'insensitive' } },
      { author: { name: { contains: '50\\%', mode: 'insensitive' } } },
    ]);
  });

  it('filtra por autor, editorial y género exactos', () => {
    const { where } = buildBookQuery({
      authorId: 'a1',
      publisherId: 'p1',
      genreId: 'g1',
    });
    expect(where).toEqual({
      deletedAt: null,
      authorId: 'a1',
      publisherId: 'p1',
      genreId: 'g1',
    });
  });

  it('available=true exige stock > 0 y available=false stock = 0', () => {
    expect(buildBookQuery({ available: 'true' }).where.stock).toEqual({
      gt: 0,
    });
    expect(buildBookQuery({ available: 'false' }).where.stock).toBe(0);
  });

  it('ordena por relaciones usando su nombre y agrega id como desempate', () => {
    expect(
      buildBookQuery({ sort: 'author:asc,publisher:desc,genre:asc,stock:desc' })
        .orderBy,
    ).toEqual([
      { author: { name: 'asc' } },
      { publisher: { name: 'desc' } },
      { genre: { name: 'asc' } },
      { stock: 'desc' },
      { id: 'asc' },
    ]);
  });

  it('propaga el 400 de un sort inválido', () => {
    expect(() => buildBookQuery({ sort: 'foo:asc' })).toThrow(
      BadRequestException,
    );
  });
});
