import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';

export const SORT_FIELDS = [
  'title',
  'price',
  'stock',
  'createdAt',
  'author',
  'publisher',
  'genre',
] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = 'asc' | 'desc';

export interface SortSpec {
  field: SortField;
  direction: SortDirection;
}

export const DEFAULT_SORT = 'createdAt:desc';

const FIELD_GROUP = SORT_FIELDS.join('|');
export const SORT_PATTERN = new RegExp(
  `^(${FIELD_GROUP}):(asc|desc)(,(${FIELD_GROUP}):(asc|desc))*$`,
);

export interface BookFilters {
  search?: string;
  authorId?: string;
  publisherId?: string;
  genreId?: string;
  available?: 'true' | 'false';
  sort?: string;
}

export interface BookQuery {
  where: Prisma.BookWhereInput;
  orderBy: Prisma.BookOrderByWithRelationInput[];
}

function isSortField(value: string): value is SortField {
  return (SORT_FIELDS as readonly string[]).includes(value);
}

/** Convierte `price:desc,title:asc` en una lista validada de criterios. */
export function parseSort(input?: string): SortSpec[] {
  const raw = input?.trim() ? input.trim() : DEFAULT_SORT;
  const seen = new Set<SortField>();

  return raw.split(',').map((part) => {
    const [field, direction, ...rest] = part.split(':');
    if (
      rest.length > 0 ||
      !isSortField(field) ||
      (direction !== 'asc' && direction !== 'desc')
    ) {
      throw new BadRequestException(`Criterio de orden inválido: "${part}"`);
    }
    if (seen.has(field)) {
      throw new BadRequestException(`Campo de orden repetido: "${field}"`);
    }
    seen.add(field);
    return { field, direction };
  });
}

function toOrderByItem({
  field,
  direction,
}: SortSpec): Prisma.BookOrderByWithRelationInput {
  switch (field) {
    case 'author':
      return { author: { name: direction } };
    case 'publisher':
      return { publisher: { name: direction } };
    case 'genre':
      return { genre: { name: direction } };
    default:
      return { [field]: direction };
  }
}

/** Escapa los comodines de LIKE para que `%` y `_` se busquen literalmente. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Búsqueda ILIKE en título y autor; sin texto no agrega condición. */
export function searchCondition(search?: string): Prisma.BookWhereInput {
  if (!search) {
    return {};
  }
  const contains = escapeLike(search);
  return {
    OR: [
      { title: { contains, mode: 'insensitive' } },
      { author: { name: { contains, mode: 'insensitive' } } },
    ],
  };
}

/** Traduce los filtros de la API a `where` y `orderBy` de Prisma (siempre excluye eliminados). */
export function buildBookQuery(filters: BookFilters): BookQuery {
  const where: Prisma.BookWhereInput = {
    deletedAt: null,
    ...searchCondition(filters.search),
  };

  if (filters.authorId) {
    where.authorId = filters.authorId;
  }
  if (filters.publisherId) {
    where.publisherId = filters.publisherId;
  }
  if (filters.genreId) {
    where.genreId = filters.genreId;
  }
  if (filters.available === 'true') {
    where.stock = { gt: 0 };
  } else if (filters.available === 'false') {
    where.stock = 0;
  }

  const orderBy = parseSort(filters.sort).map(toOrderByItem);
  orderBy.push({ id: 'asc' });
  return { where, orderBy };
}
