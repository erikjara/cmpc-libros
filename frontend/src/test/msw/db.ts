import type { Book, CatalogItem, User } from '@/lib/api-types'
import { adminUser, authors, buildBooks, genres, publishers } from './fixtures'

interface Db {
  sessionUser: User | null
  books: Book[]
  /** Soft delete: los libros eliminados siguen en `books` pero no se listan ni se leen. */
  deletedBookIds: Set<string>
  authors: CatalogItem[]
  publishers: CatalogItem[]
  genres: CatalogItem[]
}

export const db: Db = {
  sessionUser: adminUser,
  books: buildBooks(),
  deletedBookIds: new Set(),
  authors: [...authors],
  publishers: [...publishers],
  genres: [...genres],
}

export function resetDb(): void {
  db.sessionUser = adminUser
  db.books = buildBooks()
  db.deletedBookIds = new Set()
  db.authors = [...authors]
  db.publishers = [...publishers]
  db.genres = [...genres]
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
