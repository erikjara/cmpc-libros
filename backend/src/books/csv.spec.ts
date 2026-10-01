import { describe, expect, it } from 'vitest';
import { makeBook } from '../testing/book-fixtures.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  exportFileName,
  formatPrice,
  neutralizeFormula,
  toCsvRow,
} from './csv.js';

describe('toCsvRow', () => {
  it('formatea precio con coma decimal, Disponible Sí/No y fecha ISO', () => {
    expect(toCsvRow(makeBook())).toEqual({
      id: '3f2b8a54-5f0e-4f7c-9a57-3a5f9b2f6e10',
      title: 'La casa de los espíritus',
      author: 'Isabel Allende',
      publisher: 'Sudamericana',
      genre: 'Realismo mágico',
      price: '15990,50',
      stock: '3',
      available: 'Sí',
      createdAt: '2026-09-01T10:00:00.000Z',
    });
    expect(toCsvRow(makeBook({ stock: 0 })).available).toBe('No');
  });
});

describe('formatPrice', () => {
  it.each([
    ['15990.50', '15990,50'],
    ['15990.05', '15990,05'],
    ['15990.00', '15990'],
    ['0.00', '0'],
    ['0.99', '0,99'],
    ['99999999.99', '99999999,99'],
    ['1234567.00', '1234567'],
  ])('%s → %s (coma decimal, sin separador de miles)', (value, expected) => {
    expect(formatPrice(new Prisma.Decimal(value))).toBe(expected);
  });
});

describe('neutralizeFormula', () => {
  it.each(['=HYPERLINK("x")', '+1', '-1', '@SUM(A1)', '\tx', '\rx'])(
    'antepone comilla simple a %j',
    (value) => {
      expect(neutralizeFormula(value)).toBe(`'${value}`);
    },
  );

  it('no modifica textos normales', () => {
    expect(neutralizeFormula('Rayuela')).toBe('Rayuela');
  });
});

describe('exportFileName', () => {
  it('usa la fecha de Chile (America/Santiago)', () => {
    expect(exportFileName(new Date('2026-09-30T15:00:00.000Z'))).toBe(
      'libros-2026-09-30.csv',
    );
    // 01:00 UTC del 1 de octubre sigue siendo 30 de septiembre en Santiago.
    expect(exportFileName(new Date('2026-10-01T01:00:00.000Z'))).toBe(
      'libros-2026-09-30.csv',
    );
  });
});
