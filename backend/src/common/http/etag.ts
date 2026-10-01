/**
 * Versión de un recurso para bloqueo optimista: la etiqueta es su `updatedAt` en
 * ISO 8601 entre comillas (`"2026-09-30T23:58:12.345Z"`).
 */
export function formatETag(updatedAt: string): string {
  return `"${updatedAt}"`;
}

/** Condición de un header `If-Match`: el comodín `*` o una lista de etiquetas fuertes. */
export type IfMatchCondition = { any: true } | { any: false; tags: string[] };

const WEAK_PREFIX = 'W/';

/** Interpreta `If-Match`; sin valor no hay condición (gana la última escritura). */
export function parseIfMatch(
  header: string | undefined,
): IfMatchCondition | undefined {
  const value = header?.trim();
  if (!value) {
    return undefined;
  }
  if (value === '*') {
    return { any: true };
  }
  const tags = value
    .split(',')
    .map((tag) => tag.trim())
    // If-Match usa comparación fuerte: una etiqueta débil nunca coincide.
    .filter((tag) => tag !== '' && !tag.startsWith(WEAK_PREFIX))
    .map((tag) => tag.replace(/^"(.*)"$/, '$1'));
  return { any: false, tags };
}

export function matchesIfMatch(
  condition: IfMatchCondition | undefined,
  updatedAt: Date,
): boolean {
  if (!condition || condition.any) {
    return true;
  }
  return condition.tags.includes(updatedAt.toISOString());
}
