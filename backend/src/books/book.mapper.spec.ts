import { describe, expect, it } from 'vitest';
import { makeBook } from '../testing/book-fixtures.js';
import { toBookDto } from './book.mapper.js';

describe('toBookDto', () => {
  it('serializa precio como number, fechas ISO y available derivado', () => {
    expect(toBookDto(makeBook())).toEqual({
      id: '3f2b8a54-5f0e-4f7c-9a57-3a5f9b2f6e10',
      title: 'La casa de los espíritus',
      author: { id: 'a1', name: 'Isabel Allende' },
      publisher: { id: 'p1', name: 'Sudamericana' },
      genre: { id: 'g1', name: 'Realismo mágico' },
      price: 15990.5,
      stock: 3,
      available: true,
      imageUrl: null,
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-02T10:00:00.000Z',
    });
  });

  it('marca agotado con stock 0 y arma la URL pública de la imagen', () => {
    const dto = toBookDto(makeBook({ stock: 0, imageKey: 'abc.jpg' }));
    expect(dto.available).toBe(false);
    expect(dto.imageUrl).toBe('/api/uploads/abc.jpg');
  });
});
