import type { TransformFnParams } from 'class-transformer';
import { describe, expect, it } from 'vitest';
import { trimString, trimToUndefined } from './string.transforms.js';

const params = (value: unknown) => ({ value }) as TransformFnParams;

describe('trimString', () => {
  it('recorta strings y deja pasar otros tipos', () => {
    expect(trimString(params('  Rayuela  '))).toBe('Rayuela');
    expect(trimString(params(42))).toBe(42);
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
