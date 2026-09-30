import { describe, expect, it } from 'vitest'
import { buildExportUrl, fetchBooks, toQueryString } from './books.api'

describe('toQueryString', () => {
  it('omite valores vacíos o indefinidos', () => {
    expect(toQueryString({ page: 2, search: '', genreId: undefined, sort: 'title:asc' })).toBe(
      'page=2&sort=title%3Aasc',
    )
  })
})

describe('buildExportUrl', () => {
  it('apunta a /api/books/export con los filtros activos', () => {
    expect(buildExportUrl({ search: 'cien', available: 'true' })).toBe(
      '/api/books/export?search=cien&available=true',
    )
  })

  it('no agrega "?" si no hay filtros', () => {
    expect(buildExportUrl({})).toBe('/api/books/export')
  })
})

describe('fetchBooks', () => {
  it('devuelve data y meta del contrato', async () => {
    const result = await fetchBooks({ page: 1, limit: 5 })
    expect(result.data).toHaveLength(5)
    expect(result.meta).toEqual({ page: 1, limit: 5, total: 25, totalPages: 5 })
  })
})
