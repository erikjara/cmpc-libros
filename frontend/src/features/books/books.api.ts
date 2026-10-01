import { httpClient } from '@/lib/http-client'
import { toQueryString } from '@/lib/query-string'
import type {
  ApiResponse,
  Book,
  BookFilters,
  BookInput,
  BookListQuery,
  PaginatedResponse,
  TrashedBook,
  TrashListQuery,
} from '@/lib/api-types'

export { toQueryString }

export async function fetchBooks(query: BookListQuery): Promise<PaginatedResponse<Book[]>> {
  const response = await httpClient.get<PaginatedResponse<Book[]>>(`/books?${toQueryString(query)}`)
  return response.data
}

export async function fetchTrash(query: TrashListQuery): Promise<PaginatedResponse<TrashedBook[]>> {
  const response = await httpClient.get<PaginatedResponse<TrashedBook[]>>(`/books/trash?${toQueryString(query)}`)
  return response.data
}

export async function fetchBook(id: string): Promise<Book> {
  const response = await httpClient.get<ApiResponse<Book>>(`/books/${id}`)
  return response.data.data
}

export async function createBook(input: BookInput): Promise<Book> {
  const response = await httpClient.post<ApiResponse<Book>>('/books', input)
  return response.data.data
}

// Bloqueo optimista: con expectedUpdatedAt la API responde 412 si el libro cambió desde que se cargó.
// Bloqueo optimista: con la versión esperada la API responde 412 si el libro cambió desde entonces.
function ifMatchHeaders(expectedUpdatedAt?: string): Record<string, string> | undefined {
  return expectedUpdatedAt ? { 'If-Match': `"${expectedUpdatedAt}"` } : undefined
}

export async function updateBook(id: string, input: Partial<BookInput>, expectedUpdatedAt?: string): Promise<Book> {
  const response = await httpClient.patch<ApiResponse<Book>>(`/books/${id}`, input, {
    headers: ifMatchHeaders(expectedUpdatedAt),
  })
  return response.data.data
}

export async function deleteBook(id: string): Promise<void> {
  await httpClient.delete(`/books/${id}`)
}

export async function restoreBook(id: string): Promise<Book> {
  const response = await httpClient.post<ApiResponse<Book>>(`/books/${id}/restore`)
  return response.data.data
}

export async function uploadBookImage(id: string, file: File, expectedUpdatedAt?: string): Promise<Book> {
  const form = new FormData()
  form.append('image', file)
  const response = await httpClient.post<ApiResponse<Book>>(`/books/${id}/image`, form, {
    headers: ifMatchHeaders(expectedUpdatedAt),
  })
  return response.data.data
}

export function buildExportUrl(filters: BookFilters): string {
  const query = toQueryString(filters)
  return query ? `/api/books/export?${query}` : '/api/books/export'
}
