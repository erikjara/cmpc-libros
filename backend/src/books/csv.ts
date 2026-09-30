import type { BookWithRelations } from './books.repository.js';

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

export function toCsvRow(book: BookWithRelations): CsvRow {
  return {
    id: book.id,
    title: neutralizeFormula(book.title),
    author: neutralizeFormula(book.author.name),
    publisher: neutralizeFormula(book.publisher.name),
    genre: neutralizeFormula(book.genre.name),
    price: book.price.toFixed(2),
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
