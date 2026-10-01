import { http, HttpResponse, type PathParams } from 'msw'
import type { ApiErrorBody, Book, BookInput, CatalogItem, TrashedBook } from '@/lib/api-types'
import { ADMIN_PASSWORD, adminUser } from './fixtures'
import { db, findActiveBook, upsertCatalogItem } from './db'

const SORT_FIELDS = ['title', 'price', 'stock', 'createdAt', 'author', 'publisher', 'genre']
const SORT_REGEX = new RegExp(
  `^(${SORT_FIELDS.join('|')}):(asc|desc)(,(${SORT_FIELDS.join('|')}):(asc|desc))*$`,
)
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// La API responde 400 ante parámetros de query desconocidos; /books/export no acepta page/limit.
const FILTER_PARAMS = ['search', 'authorId', 'publisherId', 'genreId', 'available', 'sort']
const LIST_PARAMS = [...FILTER_PARAMS, 'page', 'limit']
const TRASH_PARAMS = ['search', 'page', 'limit']
const AUDIT_PARAMS = ['entity', 'entityId', 'page', 'limit']
const MAX_PAGE = 1_000_000
const BOOK_INPUT_FIELDS = ['title', 'authorName', 'publisherName', 'genreName', 'price', 'stock'] as const
export const STALE_BOOK_MESSAGE = 'El libro fue modificado por otra persona. Recarga para ver la versión actual.'
// CSV para Excel en es-CL: separador ';' y precio con coma decimal, sin separador de miles.
const CSV_SEPARATOR = ';'
const CSV_HEADER = ['ID', 'Título', 'Autor', 'Editorial', 'Género', 'Precio', 'Stock', 'Disponible', 'Creado'].join(CSV_SEPARATOR)

export function errorBody(statusCode: number, error: string, message: string | string[], path = '/api'): ApiErrorBody {
  return {
    statusCode,
    error,
    message,
    path,
    timestamp: new Date().toISOString(),
    requestId: 'test-request-id',
  }
}

function unauthorized(path: string) {
  return HttpResponse.json(errorBody(401, 'Unauthorized', 'No autenticado', path), { status: 401 })
}

function notFound(path: string) {
  return HttpResponse.json(errorBody(404, 'Not Found', 'Recurso no encontrado', path), { status: 404 })
}

// Bloqueo optimista: las respuestas con un libro llevan ETag = "<updatedAt>".
function bookResponse(book: Book, status = 200) {
  return HttpResponse.json({ data: book }, { status, headers: { ETag: `"${book.updatedAt}"` } })
}

function badRequest(path: string, message: string | string[]) {
  return HttpResponse.json(errorBody(400, 'Bad Request', message, path), { status: 400 })
}

// Los filtros vacíos o solo espacios se tratan como ausentes.
function queryParam(url: URL, key: string): string | undefined {
  return url.searchParams.get(key)?.trim() || undefined
}

function isIntInRange(raw: string, min: number, max: number): boolean {
  return /^\d+$/.test(raw) && Number(raw) >= min && Number(raw) <= max
}

function validateBookQuery(url: URL, allowed: readonly string[]): string[] {
  const errors: string[] = []
  for (const key of new Set(url.searchParams.keys())) {
    if (!allowed.includes(key)) errors.push(`property ${key} should not exist`)
  }
  const search = queryParam(url, 'search')
  if (search && search.length > 100) errors.push('search must be shorter than or equal to 100 characters')
  for (const key of ['authorId', 'publisherId', 'genreId']) {
    const value = queryParam(url, key)
    if (value && !UUID_REGEX.test(value)) errors.push(`${key} must be a UUID`)
  }
  const available = queryParam(url, 'available')
  if (available && available !== 'true' && available !== 'false') {
    errors.push('available must be one of the following values: true, false')
  }
  const sort = queryParam(url, 'sort')
  if (sort) {
    const fields = sort.split(',').map((part) => part.split(':')[0])
    if (!SORT_REGEX.test(sort) || new Set(fields).size !== fields.length) errors.push('Orden no válido')
  }
  const page = queryParam(url, 'page')
  if (page && !isIntInRange(page, 1, Number.MAX_SAFE_INTEGER)) errors.push('page must not be less than 1')
  const limit = queryParam(url, 'limit')
  if (limit && !isIntInRange(limit, 1, 100)) errors.push('limit must be between 1 and 100')
  return errors
}

function validateUnknownParams(url: URL, allowed: readonly string[]): string[] {
  return [...new Set(url.searchParams.keys())]
    .filter((key) => !allowed.includes(key))
    .map((key) => `property ${key} should not exist`)
}

function validatePagination(url: URL): string[] {
  const errors: string[] = []
  const page = queryParam(url, 'page')
  if (page && !isIntInRange(page, 1, MAX_PAGE)) errors.push(`page debe estar entre 1 y ${MAX_PAGE}`)
  const limit = queryParam(url, 'limit')
  if (limit && !isIntInRange(limit, 1, 100)) errors.push('limit debe estar entre 1 y 100')
  return errors
}

function paginate<T>(items: T[], url: URL) {
  const page = Number(queryParam(url, 'page') ?? 1)
  const limit = Number(queryParam(url, 'limit') ?? 10)
  const total = items.length
  return {
    data: items.slice((page - 1) * limit, page * limit),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}

function matchesSearch(book: Book, search: string | undefined): boolean {
  return !search || book.title.toLowerCase().includes(search) || book.author.name.toLowerCase().includes(search)
}

function validateName(errors: string[], field: string, value: unknown, max: number): void {
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > max) {
    errors.push(`${field} must be a string between 1 and ${max} characters`)
  }
}

// Validación básica de BookInput como en la API; `partial` para PATCH (al menos un campo).
function validateBookInput(body: unknown, partial: boolean): string[] {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return ['El cuerpo debe ser un objeto']
  const input = body as Record<string, unknown>
  const errors: string[] = []
  for (const key of Object.keys(input)) {
    if (!(BOOK_INPUT_FIELDS as readonly string[]).includes(key)) errors.push(`property ${key} should not exist`)
  }
  const present = BOOK_INPUT_FIELDS.filter((field) => input[field] !== undefined)
  if (partial && present.length === 0) errors.push('Debe enviar al menos un campo')
  if (!partial) {
    for (const field of BOOK_INPUT_FIELDS) {
      if (input[field] === undefined) errors.push(`${field} should not be empty`)
    }
  }
  if (input.title !== undefined) validateName(errors, 'title', input.title, 200)
  for (const field of ['authorName', 'publisherName', 'genreName']) {
    if (input[field] !== undefined) validateName(errors, field, input[field], 120)
  }
  const { price, stock } = input
  if (
    price !== undefined &&
    (typeof price !== 'number' ||
      !Number.isFinite(price) ||
      price < 0 ||
      price > 99_999_999.99 ||
      Math.abs(Math.round(price * 100) - price * 100) > 1e-6)
  ) {
    errors.push('price must be a number between 0 and 99999999.99 with at most 2 decimals')
  }
  if (stock !== undefined && (typeof stock !== 'number' || !Number.isInteger(stock) || stock < 0 || stock > 1_000_000)) {
    errors.push('stock must be an integer between 0 and 1000000')
  }
  return errors
}

function csvCell(value: string): string {
  // Protección contra inyección de fórmulas y escape RFC 4180.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return /[";\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

function csvPrice(price: number): string {
  return Number.isInteger(price) ? String(price) : price.toFixed(2).replace('.', ',')
}

function toCsv(books: Book[]): string {
  const rows = books.map((book) =>
    [
      book.id,
      book.title,
      book.author.name,
      book.publisher.name,
      book.genre.name,
      csvPrice(book.price),
      String(book.stock),
      book.available ? 'Sí' : 'No',
      book.createdAt,
    ]
      .map(csvCell)
      .join(CSV_SEPARATOR),
  )
  return `\uFEFF${[CSV_HEADER, ...rows].join('\r\n')}`
}

function sortValue(book: Book, field: string): string | number {
  switch (field) {
    case 'author':
      return book.author.name
    case 'publisher':
      return book.publisher.name
    case 'genre':
      return book.genre.name
    case 'title':
      return book.title
    case 'price':
      return book.price
    case 'stock':
      return book.stock
    default:
      return book.createdAt
  }
}

function applySort(books: Book[], sort: string): Book[] {
  const criteria = sort.split(',').map((part) => {
    const [field, dir] = part.split(':')
    return { field, factor: dir === 'desc' ? -1 : 1 }
  })
  return [...books].sort((a, b) => {
    for (const { field, factor } of criteria) {
      const left = sortValue(a, field)
      const right = sortValue(b, field)
      if (left < right) return -1 * factor
      if (left > right) return 1 * factor
    }
    return a.id.localeCompare(b.id)
  })
}

function filterBooks(url: URL): Book[] {
  const search = queryParam(url, 'search')?.toLowerCase()
  const authorId = queryParam(url, 'authorId')
  const publisherId = queryParam(url, 'publisherId')
  const genreId = queryParam(url, 'genreId')
  const available = queryParam(url, 'available')
  return db.books.filter(
    (book) =>
      !db.deletedBookIds.has(book.id) &&
      matchesSearch(book, search) &&
      (!authorId || book.author.id === authorId) &&
      (!publisherId || book.publisher.id === publisherId) &&
      (!genreId || book.genre.id === genreId) &&
      (!available || String(book.stock > 0) === available),
  )
}

function catalogHandler(kind: 'authors' | 'publishers' | 'genres') {
  return http.get(`/api/${kind}`, ({ request }) => {
    if (!db.sessionUser) return unauthorized(`/api/${kind}`)
    const url = new URL(request.url)
    const search = url.searchParams.get('search')?.toLowerCase() ?? ''
    const limit = Number(url.searchParams.get('limit') ?? 20)
    const list: CatalogItem[] = db[kind]
      .filter((item) => item.name.toLowerCase().includes(search))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit)
    return HttpResponse.json({ data: list })
  })
}

function buildBook(input: BookInput, base?: Book): Book {
  const now = new Date().toISOString()
  const stock = input.stock
  return {
    id: base?.id ?? crypto.randomUUID(),
    title: input.title.trim(),
    author: upsertCatalogItem(db.authors, input.authorName),
    publisher: upsertCatalogItem(db.publishers, input.publisherName),
    genre: upsertCatalogItem(db.genres, input.genreName),
    price: input.price,
    stock,
    available: stock > 0,
    imageUrl: base?.imageUrl ?? null,
    createdAt: base?.createdAt ?? now,
    updatedAt: now,
  }
}

function isSameInput(left: BookInput, right: BookInput): boolean {
  return (
    left.title.trim() === right.title &&
    left.authorName.trim() === right.authorName &&
    left.publisherName.trim() === right.publisherName &&
    left.genreName.trim() === right.genreName &&
    left.price === right.price &&
    left.stock === right.stock
  )
}

function toInput(book: Book): BookInput {
  return {
    title: book.title,
    authorName: book.author.name,
    publisherName: book.publisher.name,
    genreName: book.genre.name,
    price: book.price,
    stock: book.stock,
  }
}

export const handlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string }
    if (body.email === adminUser.email && body.password === ADMIN_PASSWORD) {
      db.sessionUser = adminUser
      return HttpResponse.json({ data: { user: adminUser } })
    }
    return HttpResponse.json(
      errorBody(401, 'Unauthorized', 'Credenciales inválidas', '/api/auth/login'),
      { status: 401 },
    )
  }),

  http.post('/api/auth/logout', () => {
    db.sessionUser = null
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/auth/me', () => {
    if (!db.sessionUser) return unauthorized('/api/auth/me')
    return HttpResponse.json({ data: db.sessionUser })
  }),

  http.get('/api/books', ({ request }) => {
    if (!db.sessionUser) return unauthorized('/api/books')
    const url = new URL(request.url)
    const errors = validateBookQuery(url, LIST_PARAMS)
    if (errors.length > 0) return badRequest('/api/books', errors)
    const sort = queryParam(url, 'sort') ?? 'createdAt:desc'
    return HttpResponse.json(paginate(applySort(filterBooks(url), sort), url))
  }),

  // Debe ir antes de /api/books/:id para que "export" no se interprete como id.
  http.get('/api/books/export', ({ request }) => {
    if (!db.sessionUser) return unauthorized('/api/books/export')
    const url = new URL(request.url)
    const errors = validateBookQuery(url, FILTER_PARAMS)
    if (errors.length > 0) return badRequest('/api/books/export', errors)
    const books = applySort(filterBooks(url), queryParam(url, 'sort') ?? 'createdAt:desc')
    const date = new Date().toISOString().slice(0, 10)
    return new HttpResponse(toCsv(books), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="libros-${date}.csv"`,
      },
    })
  }),

  // Papelera: también antes de /api/books/:id. Orden fijo deletedAt desc, id asc.
  http.get('/api/books/trash', ({ request }) => {
    if (!db.sessionUser) return unauthorized('/api/books/trash')
    const url = new URL(request.url)
    const errors = [...validateUnknownParams(url, TRASH_PARAMS), ...validatePagination(url)]
    const search = queryParam(url, 'search')
    if (search && search.length > 100) errors.push('search must be shorter than or equal to 100 characters')
    if (errors.length > 0) return badRequest('/api/books/trash', errors)
    const trashed: TrashedBook[] = db.books
      .filter((book) => db.deletedBookIds.has(book.id) && matchesSearch(book, search?.toLowerCase()))
      .map((book) => ({ ...book, deletedAt: db.deletedBookIds.get(book.id) ?? '' }))
      .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt) || a.id.localeCompare(b.id))
    return HttpResponse.json(paginate(trashed, url))
  }),

  http.get<PathParams<'id'>>('/api/books/:id', ({ params }) => {
    const id = String(params.id)
    const path = `/api/books/${id}`
    if (!db.sessionUser) return unauthorized(path)
    if (!UUID_REGEX.test(id)) return badRequest(path, 'Validation failed (uuid is expected)')
    const book = findActiveBook(id)
    if (!book) return notFound(path)
    return bookResponse(book)
  }),

  http.post('/api/books', async ({ request }) => {
    if (!db.sessionUser) return unauthorized('/api/books')
    const body: unknown = await request.json()
    const errors = validateBookInput(body, false)
    if (errors.length > 0) return badRequest('/api/books', errors)
    const book = buildBook(body as BookInput)
    db.books.push(book)
    return bookResponse(book, 201)
  }),

  http.patch<PathParams<'id'>>('/api/books/:id', async ({ params, request }) => {
    const id = String(params.id)
    const path = `/api/books/${id}`
    if (!db.sessionUser) return unauthorized(path)
    if (!UUID_REGEX.test(id)) return badRequest(path, 'Validation failed (uuid is expected)')
    const index = db.books.findIndex((item) => item.id === id)
    if (index === -1 || db.deletedBookIds.has(id)) return notFound(path)
    const body: unknown = await request.json()
    db.bookPatches.push({ id, ifMatch: request.headers.get('If-Match'), body })
    const errors = validateBookInput(body, true)
    if (errors.length > 0) return badRequest(path, errors)
    const current = db.books[index]
    // If-Match es opcional: sin él, gana la última escritura.
    const ifMatch = request.headers.get('If-Match')
    if (ifMatch !== null && ifMatch !== `"${current.updatedAt}"`) {
      return HttpResponse.json(errorBody(412, 'Precondition Failed', STALE_BOOK_MESSAGE, path), { status: 412 })
    }
    const next = { ...toInput(current), ...(body as Partial<BookInput>) }
    // Sin cambios efectivos se devuelve el libro tal cual, sin tocar updatedAt.
    if (isSameInput(next, toInput(current))) return bookResponse(current)
    const updated = buildBook(next, current)
    db.books[index] = updated
    return bookResponse(updated)
  }),

  // Soft delete: el libro deja de listarse y de leerse, pero se puede restaurar.
  http.delete<PathParams<'id'>>('/api/books/:id', ({ params }) => {
    const id = String(params.id)
    const path = `/api/books/${id}`
    if (!db.sessionUser) return unauthorized(path)
    if (!UUID_REGEX.test(id) || !findActiveBook(id)) return notFound(path)
    db.deletedBookIds.set(id, new Date().toISOString())
    return new HttpResponse(null, { status: 204 })
  }),

  // Restaurar un libro no eliminado responde 200 con el libro.
  http.post<PathParams<'id'>>('/api/books/:id/restore', ({ params }) => {
    const id = String(params.id)
    const path = `/api/books/${id}/restore`
    if (!db.sessionUser) return unauthorized(path)
    const book = db.books.find((item) => item.id === id)
    if (!book) return notFound(path)
    db.deletedBookIds.delete(book.id)
    return bookResponse(book)
  }),

  http.post<PathParams<'id'>>('/api/books/:id/image', async ({ params, request }) => {
    const id = String(params.id)
    if (!db.sessionUser) return unauthorized(`/api/books/${id}/image`)
    const book = findActiveBook(id)
    if (!book) return notFound(`/api/books/${id}/image`)
    // Se lee el multipart como texto: el File de jsdom no es compatible con request.formData()
    // de undici, así que se extrae el Content-Type de la parte "image" manualmente.
    const raw = await request.text()
    const part = /name="image"; filename="[^"]*"\r\nContent-Type: ([^\r\n]+)\r\n\r\n/.exec(raw)
    if (!part || !ALLOWED_IMAGE_TYPES.includes(part[1])) {
      return HttpResponse.json(
        errorBody(400, 'Bad Request', 'Tipo de imagen no permitido', `/api/books/${id}/image`),
        { status: 400 },
      )
    }
    if (raw.length > MAX_IMAGE_BYTES + 1024) {
      return HttpResponse.json(
        errorBody(413, 'Payload Too Large', 'La imagen supera 2 MB', `/api/books/${id}/image`),
        { status: 413 },
      )
    }
    book.imageUrl = `/api/uploads/${book.id}.webp`
    book.updatedAt = new Date().toISOString()
    return bookResponse(book)
  }),

  http.get('/api/audit-logs', ({ request }) => {
    if (!db.sessionUser) return unauthorized('/api/audit-logs')
    const url = new URL(request.url)
    const errors = [...validateUnknownParams(url, AUDIT_PARAMS), ...validatePagination(url)]
    const entity = queryParam(url, 'entity')
    if (entity && entity !== 'Book' && entity !== 'User') errors.push('entity debe ser Book o User')
    const entityId = queryParam(url, 'entityId')
    if (entityId && entityId.length > 64) errors.push('entityId no puede superar 64 caracteres')
    if (errors.length > 0) return badRequest('/api/audit-logs', errors)
    const logs = db.auditLogs
      .filter((log) => (!entity || log.entity === entity) && (!entityId || log.entityId === entityId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
    return HttpResponse.json(paginate(logs, url))
  }),

  catalogHandler('authors'),
  catalogHandler('publishers'),
  catalogHandler('genres'),
]
