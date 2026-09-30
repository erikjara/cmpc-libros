import type { Book, CatalogItem, User } from '@/lib/api-types'
import { adminUser, authors, buildBooks, genres, publishers } from './fixtures'

interface Db {
  sessionUser: User | null
  books: Book[]
  authors: CatalogItem[]
  publishers: CatalogItem[]
  genres: CatalogItem[]
}

export const db: Db = {
  sessionUser: adminUser,
  books: buildBooks(),
  authors: [...authors],
  publishers: [...publishers],
  genres: [...genres],
}

export function resetDb(): void {
  db.sessionUser = adminUser
  db.books = buildBooks()
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
