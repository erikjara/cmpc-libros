import type { TransformFnParams } from 'class-transformer';

/**
 * Recorta los extremos y colapsa cada secuencia interna de espacios en blanco (tabs, saltos
 * de línea, etc.) a un solo espacio, para que "Autor   Nuevo" y "Autor Nuevo" sean el mismo
 * valor. Deja pasar valores que no son string para que los valide class-validator.
 */
export function normalizeSpaces({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value;
}

/** Recorta espacios y trata el texto vacío como ausente (filtros opcionales de query). */
export function trimToUndefined({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
