import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { httpClient } from '@/lib/http-client'
import { buildBooks } from '@/test/msw/fixtures'
import { server } from '@/test/msw/server'
import { db } from '@/test/msw/db'
import { buildExportUrl, fetchBooks, fetchTrash, restoreBook, toQueryString, updateBook, uploadBookImage } from './books.api'

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

describe('uploadBookImage', () => {
  const file = () => new File([new Uint8Array(10)], 'p.webp', { type: 'image/webp' })

  it('envía If-Match con la versión esperada', async () => {
    await uploadBookImage(existing.id, file(), existing.updatedAt)
    expect(db.bookImageUploads).toEqual([{ id: existing.id, ifMatch: `"${existing.updatedAt}"` }])
  })

  it('sin versión esperada no envía If-Match', async () => {
    await uploadBookImage(existing.id, file())
    expect(db.bookImageUploads).toEqual([{ id: existing.id, ifMatch: null }])
  })
})

describe('fetchTrash', () => {
  it('pide la papelera sin enviar la búsqueda vacía y devuelve deletedAt', async () => {
    db.deletedBookIds.set(existing.id, '2026-09-30T12:00:00.000Z')
    const result = await fetchTrash({ page: 1, limit: 10, search: '' })
    expect(result.meta.total).toBe(1)
    expect(result.data[0]).toMatchObject({ id: existing.id, deletedAt: '2026-09-30T12:00:00.000Z' })
  })
})

describe('restoreBook', () => {
  it('restaura un libro eliminado y lo devuelve', async () => {
    db.deletedBookIds.set(existing.id, '2026-09-30T12:00:00.000Z')
    const book = await restoreBook(existing.id)
    expect(book.id).toBe(existing.id)
    expect(db.deletedBookIds.has(existing.id)).toBe(false)
  })
})
