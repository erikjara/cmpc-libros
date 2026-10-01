import { describe, expect, it } from 'vitest'
import type { BookInput } from '@/lib/api-types'
import { httpClient } from '@/lib/http-client'
import { db } from './db'
import { buildBooks } from './fixtures'
import { STALE_BOOK_MESSAGE } from './handlers'

// Los handlers de MSW deben comportarse como el contrato del backend para que los tests del
// frontend detecten requests que el servidor real rechazaría.
const [book] = buildBooks()

const validInput: BookInput = {
  title: 'Rayuela',
  authorName: 'Julio Cortázar',
  publisherName: 'Editorial Sudamericana',
  genreName: 'Novela',
  price: 12990.5,
  stock: 3,
}

async function statusOf(request: Promise<unknown>): Promise<number> {
  try {
    await request
    return 200
  } catch (error) {
    return (error as { status: number }).status
  }
}

describe('handlers de MSW: GET /books', () => {
  it('rechaza parámetros de query no permitidos con 400', async () => {
    await expect(httpClient.get('/books?page=1&foo=bar')).rejects.toMatchObject({ status: 400 })
  })

  it('valida los filtros y trata los vacíos como ausentes', async () => {
    expect(await statusOf(httpClient.get('/books?authorId=no-es-uuid'))).toBe(400)
    expect(await statusOf(httpClient.get('/books?available=quizas'))).toBe(400)
    expect(await statusOf(httpClient.get('/books?limit=101'))).toBe(400)
    expect(await statusOf(httpClient.get('/books?page=0'))).toBe(400)
    expect(await statusOf(httpClient.get('/books?sort=title:asc,title:desc'))).toBe(400)
    const response = await httpClient.get('/books?search=%20%20&genreId=')
    expect(response.data.meta.total).toBe(25)
  })
})

describe('handlers de MSW: GET /books/export', () => {
  it('devuelve un CSV para Excel en es-CL con BOM, encabezados y los filtros aplicados', async () => {
    const response = await httpClient.get<ArrayBuffer>('/books/export?search=cien&sort=title:asc', {
      responseType: 'arraybuffer',
    })
    expect(response.headers['content-type']).toContain('text/csv')
    expect(response.headers['content-disposition']).toMatch(/^attachment; filename="libros-\d{4}-\d{2}-\d{2}\.csv"$/)
    const lines = new TextDecoder('utf-8', { ignoreBOM: true }).decode(response.data).split('\r\n')
    expect(lines[0]).toBe('﻿ID;Título;Autor;Editorial;Género;Precio;Stock;Disponible;Creado')
    expect(lines[1]).toBe(
      `${book.id};Cien años de soledad;Gabriel García Márquez;Editorial Sudamericana;Novela;15990;5;Sí;${book.createdAt}`,
    )
    expect(lines).toHaveLength(2)
  })

  it('usa coma decimal en el precio y escapa celdas con ";"', async () => {
    db.books[0] = { ...db.books[0], title: 'Uno; dos', price: 15990.5 }
    const response = await httpClient.get<ArrayBuffer>('/books/export?search=uno', { responseType: 'arraybuffer' })
    const [, row] = new TextDecoder('utf-8', { ignoreBOM: true }).decode(response.data).split('\r\n')
    expect(row).toContain(';"Uno; dos";')
    expect(row).toContain(';15990,50;')
  })

  it('no acepta page ni limit', async () => {
    expect(await statusOf(httpClient.get('/books/export?page=1'))).toBe(400)
    expect(await statusOf(httpClient.get('/books/export?limit=10'))).toBe(400)
  })
})

describe('handlers de MSW: /books/:id', () => {
  it('responde 400 ante un uuid inválido', async () => {
    await expect(httpClient.get('/books/123')).rejects.toMatchObject({ status: 400 })
  })

  it('DELETE es un soft delete: el libro deja de listarse y de leerse, y se puede restaurar', async () => {
    await httpClient.delete(`/books/${book.id}`)
    expect(db.books.some((item) => item.id === book.id)).toBe(true)
    const list = await httpClient.get('/books?limit=100')
    expect(list.data.meta.total).toBe(24)
    expect(await statusOf(httpClient.get(`/books/${book.id}`))).toBe(404)
    expect(await statusOf(httpClient.delete(`/books/${book.id}`))).toBe(404)

    const restored = await httpClient.post(`/books/${book.id}/restore`)
    expect(restored.data.data.id).toBe(book.id)
    expect((await httpClient.get(`/books/${book.id}`)).data.data.title).toBe(book.title)
    // Restaurar un libro no eliminado responde 200 con el libro.
    expect(await statusOf(httpClient.post(`/books/${book.id}/restore`))).toBe(200)
    expect(await statusOf(httpClient.post('/books/40000000-0000-4000-8000-999999999999/restore'))).toBe(404)
  })
})

describe('handlers de MSW: validación de BookInput', () => {
  it('crea un libro válido', async () => {
    const response = await httpClient.post('/books', validInput)
    expect(response.status).toBe(201)
    expect(response.data.data).toMatchObject({ title: 'Rayuela', price: 12990.5, stock: 3, available: true })
  })

  it.each([
    ['título vacío', { title: '   ' }],
    ['autor demasiado largo', { authorName: 'a'.repeat(121) }],
    ['precio negativo', { price: -1 }],
    ['precio con 3 decimales', { price: 1.234 }],
    ['stock decimal', { stock: 1.5 }],
    ['stock sobre el máximo', { stock: 1_000_001 }],
    ['campo no permitido', { isbn: '123' }],
  ])('rechaza %s con 400 y ApiErrorBody', async (_case, patch) => {
    const error = await httpClient.post('/books', { ...validInput, ...patch }).catch((caught: unknown) => caught)
    expect(error).toMatchObject({ status: 400, details: expect.arrayContaining([expect.any(String)]) })
  })

  it('exige todos los campos al crear', async () => {
    const { stock: _stock, ...withoutStock } = validInput
    expect(await statusOf(httpClient.post('/books', withoutStock))).toBe(400)
  })

  it('PATCH acepta un subconjunto pero exige al menos un campo', async () => {
    expect(await statusOf(httpClient.patch(`/books/${book.id}`, { stock: 0 }))).toBe(200)
    expect(await statusOf(httpClient.patch(`/books/${book.id}`, {}))).toBe(400)
    expect(await statusOf(httpClient.patch(`/books/${book.id}`, { price: 'caro' }))).toBe(400)
  })
})

describe('handlers de MSW: bloqueo optimista', () => {
  const etagOf = (value: string) => `"${value}"`

  it('responde ETag con el updatedAt del libro en lectura y escritura', async () => {
    const read = await httpClient.get(`/books/${book.id}`)
    expect(read.headers.etag).toBe(etagOf(book.updatedAt))
    const created = await httpClient.post('/books', validInput)
    expect(created.headers.etag).toBe(etagOf(created.data.data.updatedAt))
    const restored = await httpClient.post(`/books/${book.id}/restore`)
    expect(restored.headers.etag).toBe(etagOf(restored.data.data.updatedAt))
  })

  it('PATCH con If-Match vigente guarda y devuelve el nuevo ETag', async () => {
    const response = await httpClient.patch(`/books/${book.id}`, { stock: 9 }, { headers: { 'If-Match': etagOf(book.updatedAt) } })
    expect(response.data.data.stock).toBe(9)
    expect(response.data.data.updatedAt).not.toBe(book.updatedAt)
    expect(response.headers.etag).toBe(etagOf(response.data.data.updatedAt))
  })

  it('PATCH con If-Match desactualizado responde 412 sin modificar el libro', async () => {
    const error = await httpClient
      .patch(`/books/${book.id}`, { stock: 9 }, { headers: { 'If-Match': etagOf('2020-01-01T00:00:00.000Z') } })
      .catch((caught: unknown) => caught)
    expect(error).toMatchObject({ status: 412, message: STALE_BOOK_MESSAGE })
    expect(db.books[0].stock).toBe(book.stock)
  })

  it('PATCH sin If-Match mantiene "gana la última escritura"', async () => {
    expect(await statusOf(httpClient.patch(`/books/${book.id}`, { stock: 9 }))).toBe(200)
  })

  it('PATCH sin cambios efectivos no modifica updatedAt', async () => {
    const response = await httpClient.patch(
      `/books/${book.id}`,
      { title: book.title, price: book.price, stock: book.stock },
      { headers: { 'If-Match': etagOf(book.updatedAt) } },
    )
    expect(response.data.data.updatedAt).toBe(book.updatedAt)
    expect(response.headers.etag).toBe(etagOf(book.updatedAt))
  })
})

describe('handlers de MSW: GET /books/trash', () => {
  const books = buildBooks()

  it('lista solo los eliminados, del más reciente al más antiguo, con deletedAt', async () => {
    db.deletedBookIds.set(books[0].id, '2026-09-01T10:00:00.000Z')
    db.deletedBookIds.set(books[1].id, '2026-09-02T10:00:00.000Z')
    const response = await httpClient.get('/books/trash')
    expect(response.data.meta).toEqual({ page: 1, limit: 10, total: 2, totalPages: 1 })
    expect(response.data.data.map((item: { id: string }) => item.id)).toEqual([books[1].id, books[0].id])
    expect(response.data.data[0].deletedAt).toBe('2026-09-02T10:00:00.000Z')
  })

  it('busca por título o autor y pagina', async () => {
    for (const [index, item] of books.entries()) {
      db.deletedBookIds.set(item.id, new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString())
    }
    const page = await httpClient.get('/books/trash?page=3&limit=10')
    expect(page.data.meta).toEqual({ page: 3, limit: 10, total: 25, totalPages: 3 })
    expect(page.data.data).toHaveLength(5)
    const search = await httpClient.get('/books/trash?search=allende')
    expect(search.data.data.map((item: { title: string }) => item.title)).toContain('La casa de los espíritus')
  })

  it('valida el query como la API', async () => {
    expect(await statusOf(httpClient.get('/books/trash?sort=title:asc'))).toBe(400)
    expect(await statusOf(httpClient.get('/books/trash?page=1000001'))).toBe(400)
    expect(await statusOf(httpClient.get('/books/trash?limit=0'))).toBe(400)
    expect(await statusOf(httpClient.get(`/books/trash?search=${'a'.repeat(101)}`))).toBe(400)
    expect(await statusOf(httpClient.get('/books/trash?search=%20'))).toBe(200)
  })

  it('DELETE registra la fecha de eliminación y restore la quita', async () => {
    await httpClient.delete(`/books/${books[2].id}`)
    const trash = await httpClient.get('/books/trash')
    expect(trash.data.data[0]).toMatchObject({ id: books[2].id, deletedAt: expect.any(String) })
    await httpClient.post(`/books/${books[2].id}/restore`)
    expect((await httpClient.get('/books/trash')).data.meta.total).toBe(0)
  })
})

describe('handlers de MSW: GET /audit-logs', () => {
  it('pagina los registros ordenados por fecha descendente', async () => {
    const response = await httpClient.get('/audit-logs?limit=5')
    const logs = response.data.data as { createdAt: string }[]
    expect(response.data.meta).toMatchObject({ page: 1, limit: 5 })
    expect(response.data.meta.total).toBeGreaterThan(5)
    expect(logs.map((log) => log.createdAt)).toEqual([...logs.map((log) => log.createdAt)].sort().reverse())
  })

  it('filtra por entidad y por entityId', async () => {
    const users = await httpClient.get('/audit-logs?entity=User&limit=100')
    expect(users.data.data.every((log: { entity: string }) => log.entity === 'User')).toBe(true)
    expect(users.data.meta.total).toBeGreaterThan(0)
    const [first] = (await httpClient.get('/audit-logs?entity=Book')).data.data
    const byId = await httpClient.get(`/audit-logs?entityId=${first.entityId}&limit=100`)
    expect(byId.data.data.every((log: { entityId: string }) => log.entityId === first.entityId)).toBe(true)
  })

  it('valida el query como la API', async () => {
    expect(await statusOf(httpClient.get('/audit-logs?entity=Author'))).toBe(400)
    expect(await statusOf(httpClient.get('/audit-logs?action=CREATE'))).toBe(400)
    expect(await statusOf(httpClient.get('/audit-logs?limit=101'))).toBe(400)
  })
})
