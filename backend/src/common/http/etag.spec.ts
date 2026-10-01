import { describe, expect, it } from 'vitest';
import { formatETag, matchesIfMatch, parseIfMatch } from './etag.js';

const UPDATED_AT = new Date('2026-09-30T23:58:12.345Z');

describe('formatETag', () => {
  it('entrecomilla la fecha ISO 8601', () => {
    expect(formatETag('2026-09-30T23:58:12.345Z')).toBe(
      '"2026-09-30T23:58:12.345Z"',
    );
  });
});

describe('parseIfMatch', () => {
  it.each([undefined, '', '   '])(
    'sin valor (%j) no hay condición',
    (value) => {
      expect(parseIfMatch(value)).toBeUndefined();
    },
  );

  it('reconoce el comodín *', () => {
    expect(parseIfMatch(' * ')).toEqual({ any: true });
  });

  it('extrae etiquetas fuertes, una o varias separadas por coma', () => {
    expect(parseIfMatch('"2026-09-30T23:58:12.345Z"')).toEqual({
      any: false,
      tags: ['2026-09-30T23:58:12.345Z'],
    });
    expect(parseIfMatch('"a", "b"')).toEqual({ any: false, tags: ['a', 'b'] });
  });

  it('acepta la etiqueta sin comillas', () => {
    expect(parseIfMatch('2026-09-30T23:58:12.345Z')).toEqual({
      any: false,
      tags: ['2026-09-30T23:58:12.345Z'],
    });
  });

  it('descarta etiquetas débiles (W/): If-Match usa comparación fuerte', () => {
    expect(parseIfMatch('W/"2026-09-30T23:58:12.345Z"')).toEqual({
      any: false,
      tags: [],
    });
  });
});

describe('matchesIfMatch', () => {
  it('sin condición siempre coincide', () => {
    expect(matchesIfMatch(undefined, UPDATED_AT)).toBe(true);
  });

  it('el comodín coincide con cualquier versión', () => {
    expect(matchesIfMatch({ any: true }, UPDATED_AT)).toBe(true);
  });

  it('coincide solo con el updatedAt exacto (milisegundos incluidos)', () => {
    expect(
      matchesIfMatch(parseIfMatch('"2026-09-30T23:58:12.345Z"'), UPDATED_AT),
    ).toBe(true);
    expect(
      matchesIfMatch(parseIfMatch('"2026-09-30T23:58:12.344Z"'), UPDATED_AT),
    ).toBe(false);
    expect(matchesIfMatch(parseIfMatch('"basura"'), UPDATED_AT)).toBe(false);
    expect(
      matchesIfMatch(parseIfMatch('W/"2026-09-30T23:58:12.345Z"'), UPDATED_AT),
    ).toBe(false);
  });
});
