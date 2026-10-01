/** `SEED_DEMO_DATA`: "true" o "false" (por defecto false: sin datos de demostración). */
export function parseSeedDemoData(raw: string | undefined): boolean {
  const value = raw?.trim() ?? '';
  if (value === '' || value === 'false') {
    return false;
  }
  if (value === 'true') {
    return true;
  }
  throw new Error(
    `SEED_DEMO_DATA debe ser "true" o "false" (recibido: "${value}")`,
  );
}

/**
 * Los libros de demostración solo se insertan en una base sin libros (contando los
 * eliminados): así el seed nunca mezcla datos de demostración con un inventario real.
 */
export function shouldSeedDemoBooks(
  demoData: boolean,
  existingBooks: number,
): boolean {
  return demoData && existingBooks === 0;
}
