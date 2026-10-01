import type { Prisma } from '../generated/prisma/client.js';
import type { BookWithRelations } from './books.repository.js';

/** Excel con configuración regional es-CL usa `;` como separador de listas. */
export const CSV_DELIMITER = ';';

export const CSV_COLUMNS = [
  { key: 'id', header: 'ID' },
  { key: 'title', header: 'Título' },
  { key: 'author', header: 'Autor' },
  { key: 'publisher', header: 'Editorial' },
  { key: 'genre', header: 'Género' },
  { key: 'price', header: 'Precio' },
  { key: 'stock', header: 'Stock' },
  { key: 'available', header: 'Disponible' },
  { key: 'createdAt', header: 'Creado' },
] as const;

export type CsvRow = Record<(typeof CSV_COLUMNS)[number]['key'], string>;

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Evita inyección de fórmulas al abrir el CSV en Excel (OWASP CSV Injection). */
export function neutralizeFormula(value: string): string {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

/** Coma decimal y sin separador de miles: `15990,50`; los enteros sin decimales: `15990`. */
export function formatPrice(price: Prisma.Decimal): string {
  return price.isInteger()
    ? price.toFixed(0)
    : price.toFixed(2).replace('.', ',');
}

export function toCsvRow(book: BookWithRelations): CsvRow {
  return {
    id: book.id,
    title: neutralizeFormula(book.title),
    author: neutralizeFormula(book.author.name),
    publisher: neutralizeFormula(book.publisher.name),
    genre: neutralizeFormula(book.genre.name),
    price: formatPrice(book.price),
    stock: String(book.stock),
    available: book.stock > 0 ? 'Sí' : 'No',
    createdAt: book.createdAt.toISOString(),
  };
}

const EXPORT_TIME_ZONE = 'America/Santiago';

/** `libros-YYYY-MM-DD.csv` con la fecha local de Chile. */
export function exportFileName(now: Date): string {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: EXPORT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return `libros-${date}.csv`;
}
