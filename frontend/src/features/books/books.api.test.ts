import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { httpClient } from '@/lib/http-client'
import { buildBooks } from '@/test/msw/fixtures'
import { server } from '@/test/msw/server'
import { buildExportUrl, fetchBooks, toQueryString, updateBook } from './books.api'

const [existing] = buildBooks()

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

  it('genera una URL que la API acepta (sin page ni limit)', async () => {
    const url = buildExportUrl({ search: 'cien', available: 'true', sort: 'title:asc' })
    const response = await httpClient.get(url.replace(/^\/api/, ''), { responseType: 'text' })
    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('text/csv')
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

describe('updateBook', () => {
  it('envía If-Match con el updatedAt del libro cargado', async () => {
    let ifMatch: string | null = null
    server.use(
      http.patch('/api/books/:id', ({ request }) => {
        ifMatch = request.headers.get('If-Match')
        return HttpResponse.json({ data: existing })
      }),
    )
    await updateBook(existing.id, { stock: 1 }, '2026-09-30T23:58:12.345Z')
    expect(ifMatch).toBe('"2026-09-30T23:58:12.345Z"')
  })

  it('sin versión esperada no envía If-Match', async () => {
    let ifMatch: string | null = 'sin consultar'
    server.use(
      http.patch('/api/books/:id', ({ request }) => {
        ifMatch = request.headers.get('If-Match')
        return HttpResponse.json({ data: existing })
      }),
    )
    await updateBook(existing.id, { stock: 1 })
    expect(ifMatch).toBeNull()
  })
})
