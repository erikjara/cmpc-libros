import type { TransformFnParams } from 'class-transformer';

/** Recorta espacios; deja pasar valores que no son string para que los valide class-validator. */
export function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/** Recorta espacios y trata el texto vacío como ausente (filtros opcionales de query). */
export function trimToUndefined({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
