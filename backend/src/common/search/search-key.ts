// Módulo sin dependencias: también lo importa el seed (prisma/seed.ts), que en la imagen
// Docker se ejecuta con tsx fuera de dist/.

/** Marcas diacríticas combinantes (bloque U+0300–U+036F): tildes, diéresis, virgulilla… */
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Clave de búsqueda: minúsculas, sin diacríticos y con los espacios colapsados, para que
 * "García Márquez", "garcia marquez" y "GARCIA  MARQUEZ" coincidan. La "ñ" se trata como
 * "n" (NFD la descompone en "n" + virgulilla): buscar "nino" encuentra "Niño" y viceversa,
 * igual que con las demás tildes, porque es lo que suele escribir quien no tiene la tecla.
 *
 * Se guarda en `books.title_search` y `books.author_search` y se aplica al término buscado.
 * La migración `busqueda_sin_tildes` calcula lo mismo en SQL para las filas existentes:
 * cualquier cambio aquí requiere una migración que recalcule ambas columnas.
 */
export function toSearchKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
