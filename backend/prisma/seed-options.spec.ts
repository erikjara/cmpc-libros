import { describe, expect, it } from 'vitest';
import { parseSeedDemoData, shouldSeedDemoBooks } from './seed-options.js';

describe('parseSeedDemoData', () => {
  it('por defecto no inserta datos de demostración', () => {
    expect(parseSeedDemoData(undefined)).toBe(false);
    expect(parseSeedDemoData('')).toBe(false);
  });

  it('acepta true y false', () => {
    expect(parseSeedDemoData('true')).toBe(true);
    expect(parseSeedDemoData(' false ')).toBe(false);
  });

  it('rechaza otros valores para no ignorar un error de configuración', () => {
    expect(() => parseSeedDemoData('si')).toThrow(
      'SEED_DEMO_DATA debe ser "true" o "false" (recibido: "si")',
    );
  });
});

describe('shouldSeedDemoBooks', () => {
  it('solo con SEED_DEMO_DATA=true y la tabla books vacía (incluidos eliminados)', () => {
    expect(shouldSeedDemoBooks(true, 0)).toBe(true);
    expect(shouldSeedDemoBooks(true, 1)).toBe(false);
    expect(shouldSeedDemoBooks(false, 0)).toBe(false);
  });
});
