import { describe, expect, it } from 'vitest';
import { toSearchKey } from './search-key.js';

describe('toSearchKey', () => {
  it.each([
    ['García Márquez', 'garcia marquez'],
    ['Luis Sepúlveda', 'luis sepulveda'],
    ['SEPULVEDA', 'sepulveda'],
    ['ÁÉÍÓÚ áéíóú', 'aeiou aeiou'],
    ['Pingüino ÜBER', 'pinguino uber'],
    ['Niño Ñandú', 'nino nandu'],
    ['  Cien   años\tde\nsoledad  ', 'cien anos de soledad'],
    ['Cien años', 'cien anos'],
    // Forma ya descompuesta (NFD): "e" + tilde combinante
    ['René', 'rene'],
    ['Ça va, Ångström', 'ca va, angstrom'],
    ['100% real_libro', '100% real_libro'],
    ['   ', ''],
    ['', ''],
  ])('normaliza %j a %j', (input, expected) => {
    expect(toSearchKey(input)).toBe(expected);
  });

  it('es idempotente', () => {
    const key = toSearchKey('  Él  Pingüino de Ñuñoa ');
    expect(toSearchKey(key)).toBe(key);
  });
});
