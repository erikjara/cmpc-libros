import type { AuditLog, Book, CatalogItem, User } from '@/lib/api-types'
import { adminUser, authors, buildAuditLogs, buildBooks, genres, publishers } from './fixtures'

interface Db {
  sessionUser: User | null
  books: Book[]
  /** Soft delete: id → fecha de eliminación. Siguen en `books` pero no se listan ni se leen. */
  deletedBookIds: Map<string, string>
  authors: CatalogItem[]
  publishers: CatalogItem[]
  genres: CatalogItem[]
  auditLogs: AuditLog[]
  /** PATCH /books/:id recibidos, para verificar qué campos y qué If-Match envía el cliente. */
  bookPatches: BookPatchRequest[]
  /** POST /books/:id/image recibidos, para verificar qué If-Match envía el cliente. */
  bookImageUploads: BookImageUploadRequest[]
}

export interface BookImageUploadRequest {
  id: string
  ifMatch: string | null
}

export interface BookPatchRequest {
  id: string
  ifMatch: string | null
  body: unknown
}

export const db: Db = {
  sessionUser: adminUser,
  books: buildBooks(),
  deletedBookIds: new Map(),
  authors: [...authors],
  publishers: [...publishers],
  genres: [...genres],
  auditLogs: buildAuditLogs(),
  bookPatches: [],
  bookImageUploads: [],
}

export function resetDb(): void {
  db.sessionUser = adminUser
  db.books = buildBooks()
  db.deletedBookIds = new Map()
  db.authors = [...authors]
  db.publishers = [...publishers]
  db.genres = [...genres]
  db.auditLogs = buildAuditLogs()
  db.bookPatches = []
  db.bookImageUploads = []
}

export function upsertCatalogItem(list: CatalogItem[], rawName: string): CatalogItem {
  const name = rawName.trim()
  const existing = list.find((item) => item.name === name)
  if (existing) return existing
  const created: CatalogItem = { id: crypto.randomUUID(), name }
  list.push(created)
  return created
}

export function findActiveBook(id: string): Book | undefined {
  return db.deletedBookIds.has(id) ? undefined : db.books.find((book) => book.id === id)
}

// Simula que otra persona guarda cambios por la API entre dos lecturas del cliente: el libro
// cambia y su updatedAt (la versión del ETag) avanza.
export function simulateExternalUpdate(id: string, changes: Partial<Pick<Book, 'title' | 'price' | 'stock'>>): Book {
  const index = db.books.findIndex((book) => book.id === id)
  if (index === -1) throw new Error(`Libro ${id} no existe`)
  const current = db.books[index]
  const stock = changes.stock ?? current.stock
  const updatedAt = new Date(Math.max(Date.now(), Date.parse(current.updatedAt) + 1)).toISOString()
  const updated: Book = { ...current, ...changes, available: stock > 0, updatedAt }
  db.books[index] = updated
  return updated
}
