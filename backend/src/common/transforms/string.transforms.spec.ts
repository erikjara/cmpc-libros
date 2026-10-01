import type { TransformFnParams } from 'class-transformer';
import { describe, expect, it } from 'vitest';
import { normalizeSpaces, trimToUndefined } from './string.transforms.js';

const params = (value: unknown) => ({ value }) as TransformFnParams;

describe('normalizeSpaces', () => {
  it.each([
    ['  Rayuela  ', 'Rayuela'],
    ['Autor   Nuevo', 'Autor Nuevo'],
    ['  Autor   Nuevo ', 'Autor Nuevo'],
    ['Autor\tNuevo', 'Autor Nuevo'],
    ['Autor\n\r\nNuevo', 'Autor Nuevo'],
    ['\t Gabriel \n García\u00a0 Márquez \n', 'Gabriel García Márquez'],
    ['   ', ''],
    ['\t\n ', ''],
    ['', ''],
  ])('normaliza %j a %j', (input, expected) => {
    expect(normalizeSpaces(params(input))).toBe(expected);
  });

  it('deja pasar valores que no son string', () => {
    expect(normalizeSpaces(params(42))).toBe(42);
    expect(normalizeSpaces(params(null))).toBeNull();
    expect(normalizeSpaces(params(undefined))).toBeUndefined();
  });
});

describe('trimToUndefined', () => {
  it('convierte texto vacío o solo espacios en undefined', () => {
    expect(trimToUndefined(params('   '))).toBeUndefined();
    expect(trimToUndefined(params(''))).toBeUndefined();
  });

  it('recorta el resto y deja pasar otros tipos', () => {
    expect(trimToUndefined(params(' allende '))).toBe('allende');
    expect(trimToUndefined(params(['a']))).toEqual(['a']);
  });
});
