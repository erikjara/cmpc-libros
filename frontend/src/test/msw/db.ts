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
}

export const db: Db = {
  sessionUser: adminUser,
  books: buildBooks(),
  deletedBookIds: new Map(),
  authors: [...authors],
  publishers: [...publishers],
  genres: [...genres],
  auditLogs: buildAuditLogs(),
}

export function resetDb(): void {
  db.sessionUser = adminUser
  db.books = buildBooks()
  db.deletedBookIds = new Map()
  db.authors = [...authors]
  db.publishers = [...publishers]
  db.genres = [...genres]
  db.auditLogs = buildAuditLogs()
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
