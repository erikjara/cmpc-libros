// Tipos del contrato de la API (ver Swagger en /api/docs).
export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ApiResponse<T> {
  data: T
  meta?: PaginationMeta
}

export interface PaginatedResponse<T> {
  data: T
  meta: PaginationMeta
}

export interface ApiErrorBody {
  statusCode: number
  error: string
  message: string | string[]
  path: string
  timestamp: string
  requestId: string
}

export interface User {
  id: string
  email: string
  name: string
}

export interface CatalogItem {
  id: string
  name: string
}

export interface Book {
  id: string
  title: string
  author: CatalogItem
  publisher: CatalogItem
  genre: CatalogItem
  price: number
  stock: number
  available: boolean
  imageUrl: string | null
  createdAt: string
  updatedAt: string
}

/** Libro eliminado (soft delete) tal como lo devuelve la papelera. */
export interface TrashedBook extends Book {
  deletedAt: string
}

export interface TrashListQuery {
  page?: number
  limit?: number
  search?: string
}

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'EXPORT' | 'LOGIN'

export type AuditEntity = 'Book' | 'User'

export interface AuditLog {
  id: string
  action: AuditAction
  entity: string
  entityId: string | null
  user: User | null
  /** `{ before?, after? }` o metadatos (p. ej. `{ filters }` en una exportación). */
  changes: unknown
  ip: string | null
  createdAt: string
}

export interface AuditLogQuery {
  page?: number
  limit?: number
  entity?: AuditEntity
  entityId?: string
}

export type SortField =
  | 'title'
  | 'price'
  | 'stock'
  | 'createdAt'
  | 'author'
  | 'publisher'
  | 'genre'

export type SortDirection = 'asc' | 'desc'

export interface BookFilters {
  search?: string
  authorId?: string
  publisherId?: string
  genreId?: string
  available?: 'true' | 'false'
  sort?: string
}

export interface BookListQuery extends BookFilters {
  page?: number
  limit?: number
}

export interface BookInput {
  title: string
  authorName: string
  publisherName: string
  genreName: string
  price: number
  stock: number
}

export interface LoginInput {
  email: string
  password: string
}

export type CatalogKind = 'authors' | 'publishers' | 'genres'
