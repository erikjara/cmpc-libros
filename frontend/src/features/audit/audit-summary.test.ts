import { describe, expect, it } from 'vitest'
import type { AuditAction } from '@/lib/api-types'
import { buildBooks } from '@/test/msw/fixtures'
import { summarizeChanges } from './audit-summary'

const [book] = buildBooks()
const renamed = { ...book, author: { id: 'x', name: 'Gabo' } }

describe('summarizeChanges', () => {
  it.each<[string, AuditAction, unknown, string]>([
    ['UPDATE: un campo', 'UPDATE', { before: book, after: { ...book, stock: 0, available: false } }, 'stock: 5 → 0'],
    [
      'UPDATE: varios campos en orden fijo, precio en CLP y catálogos por nombre',
      'UPDATE',
      { before: book, after: { ...renamed, title: 'Cien años', price: 12990, updatedAt: '2026-10-01T00:00:00.000Z' } },
      'título: Cien años de soledad → Cien años · autor: Gabriel García Márquez → Gabo · precio: $15.990 → $12.990',
    ],
    ['UPDATE: imagen', 'UPDATE', { before: { imageKey: null }, after: { imageKey: 'a.webp' } }, 'imagen actualizada'],
    ['UPDATE: imagen eliminada', 'UPDATE', { before: { imageKey: 'a.webp' }, after: { imageKey: null } }, 'imagen eliminada'],
    ['UPDATE: campo desconocido', 'UPDATE', { before: { notes: 'a' }, after: { notes: 'b' } }, 'notes: a → b'],
    ['UPDATE: valor ausente', 'UPDATE', { before: {}, after: { stock: 3 } }, 'stock: — → 3'],
    ['UPDATE: sin diferencias', 'UPDATE', { before: book, after: { ...book } }, 'Sin cambios'],
    ['UPDATE: sin before/after', 'UPDATE', { foo: 1 }, '—'],
    ['CREATE: título', 'CREATE', { after: book }, 'Cien años de soledad'],
    ['DELETE: título', 'DELETE', { before: book }, 'Cien años de soledad'],
    ['RESTORE: título', 'RESTORE', { after: book }, 'Cien años de soledad'],
    ['CREATE: sin título', 'CREATE', { after: { id: '1' } }, '—'],
    [
      'EXPORT: filtros con etiquetas',
      'EXPORT',
      {
        filters: {
          search: 'neruda',
          available: 'true',
          sort: 'title:asc,price:desc',
          authorId: '10000000-0000-4000-8000-000000000001',
        },
      },
      'búsqueda: neruda · disponibilidad: disponibles · orden: título ↑, precio ↓ · autor: 10000000…',
    ],
    ['EXPORT: agotados y filtro desconocido', 'EXPORT', { filters: { available: 'false', foo: 'x' } }, 'disponibilidad: agotados · foo: x'],
    ['EXPORT: sin filtros', 'EXPORT', { filters: {} }, 'Sin filtros'],
    ['EXPORT: sin metadatos', 'EXPORT', null, 'Sin filtros'],
    ['LOGIN', 'LOGIN', null, '—'],
    ['cambios que no son objeto', 'UPDATE', 'texto', '—'],
  ])('%s', (_name, action, changes, expected) => {
    expect(summarizeChanges({ action, changes })).toBe(expected)
  })
})
