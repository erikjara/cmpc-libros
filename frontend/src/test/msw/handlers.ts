import { http, HttpResponse, type PathParams } from 'msw'
import type { ApiErrorBody, Book, BookInput, CatalogItem } from '@/lib/api-types'
import { ADMIN_PASSWORD, adminUser } from './fixtures'
import { db, upsertCatalogItem } from './db'

const SORT_FIELDS = ['title', 'price', 'stock', 'createdAt', 'author', 'publisher', 'genre']
const SORT_REGEX = new RegExp(
  `^(${SORT_FIELDS.join('|')}):(asc|desc)(,(${SORT_FIELDS.join('|')}):(asc|desc))*$`,
)
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 2 * 1024 * 1024

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
  const search = url.searchParams.get('search')?.toLowerCase()
  const authorId = url.searchParams.get('authorId')
  const publisherId = url.searchParams.get('publisherId')
  const genreId = url.searchParams.get('genreId')
  const available = url.searchParams.get('available')
  return db.books.filter(
    (book) =>
      (!search ||
        book.title.toLowerCase().includes(search) ||
        book.author.name.toLowerCase().includes(search)) &&
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
    const sort = url.searchParams.get('sort') ?? 'createdAt:desc'
    if (!SORT_REGEX.test(sort)) {
      return HttpResponse.json(errorBody(400, 'Bad Request', 'Orden no válido', '/api/books'), {
        status: 400,
      })
    }
    const page = Number(url.searchParams.get('page') ?? 1)
    const limit = Number(url.searchParams.get('limit') ?? 10)
    const sorted = applySort(filterBooks(url), sort)
    const total = sorted.length
    const totalPages = Math.ceil(total / limit)
    const data = sorted.slice((page - 1) * limit, page * limit)
    return HttpResponse.json({ data, meta: { page, limit, total, totalPages } })
  }),

  http.get<PathParams<'id'>>('/api/books/:id', ({ params }) => {
    if (!db.sessionUser) return unauthorized(`/api/books/${params.id}`)
    const book = db.books.find((item) => item.id === params.id)
    if (!book) return notFound(`/api/books/${params.id}`)
    return HttpResponse.json({ data: book })
  }),

  http.post('/api/books', async ({ request }) => {
    if (!db.sessionUser) return unauthorized('/api/books')
    const input = (await request.json()) as BookInput
    const book = buildBook(input)
    db.books.push(book)
    return HttpResponse.json({ data: book }, { status: 201 })
  }),

  http.patch<PathParams<'id'>>('/api/books/:id', async ({ params, request }) => {
    if (!db.sessionUser) return unauthorized(`/api/books/${params.id}`)
    const index = db.books.findIndex((item) => item.id === params.id)
    if (index === -1) return notFound(`/api/books/${params.id}`)
    const patch = (await request.json()) as Partial<BookInput>
    const updated = buildBook({ ...toInput(db.books[index]), ...patch }, db.books[index])
    db.books[index] = updated
    return HttpResponse.json({ data: updated })
  }),

  http.delete<PathParams<'id'>>('/api/books/:id', ({ params }) => {
    if (!db.sessionUser) return unauthorized(`/api/books/${params.id}`)
    const index = db.books.findIndex((item) => item.id === params.id)
    if (index === -1) return notFound(`/api/books/${params.id}`)
    db.books.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post<PathParams<'id'>>('/api/books/:id/image', async ({ params, request }) => {
    if (!db.sessionUser) return unauthorized(`/api/books/${params.id}/image`)
    const book = db.books.find((item) => item.id === params.id)
    if (!book) return notFound(`/api/books/${params.id}/image`)
    // Se lee el multipart como texto: el File de jsdom no es compatible con request.formData()
    // de undici, así que se extrae el Content-Type de la parte "image" manualmente.
    const raw = await request.text()
    const part = /name="image"; filename="[^"]*"\r\nContent-Type: ([^\r\n]+)\r\n\r\n/.exec(raw)
    if (!part || !ALLOWED_IMAGE_TYPES.includes(part[1])) {
      return HttpResponse.json(
        errorBody(400, 'Bad Request', 'Tipo de imagen no permitido', `/api/books/${params.id}/image`),
        { status: 400 },
      )
    }
    if (raw.length > MAX_IMAGE_BYTES + 1024) {
      return HttpResponse.json(
        errorBody(413, 'Payload Too Large', 'La imagen supera 2 MB', `/api/books/${params.id}/image`),
        { status: 413 },
      )
    }
    book.imageUrl = `/api/uploads/${book.id}.webp`
    return HttpResponse.json({ data: book })
  }),

  catalogHandler('authors'),
  catalogHandler('publishers'),
  catalogHandler('genres'),
]
