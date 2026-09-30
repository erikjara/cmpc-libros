import { Prisma } from '../generated/prisma/client.js';

const CATALOG_MODELS = new Set(['Author', 'Publisher', 'Genre']);
const CATALOG_TABLES = new Set(['authors', 'publishers', 'genres']);

interface UniqueViolationMeta {
  modelName?: unknown;
  driverAdapterError?: { cause?: { table?: unknown } };
}

/**
 * P2002 sobre autores, editoriales o géneros: dos transacciones crearon a la vez el
 * mismo nombre nuevo con `connectOrCreate` y perdió la segunda. Con `@prisma/adapter-pg`
 * el modelo llega en `meta.modelName` y la tabla en `meta.driverAdapterError.cause.table`.
 */
export function isCatalogNameConflict(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }
  const meta = (error.meta ?? {}) as UniqueViolationMeta;
  return (
    CATALOG_MODELS.has(String(meta.modelName)) ||
    CATALOG_TABLES.has(String(meta.driverAdapterError?.cause?.table))
  );
}
