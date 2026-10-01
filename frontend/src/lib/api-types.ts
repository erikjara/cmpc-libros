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
