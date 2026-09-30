import { httpClient } from '@/lib/http-client'
import type { ApiResponse, Book, BookFilters, BookListQuery, PaginatedResponse } from '@/lib/api-types'

export function toQueryString(params: BookListQuery | BookFilters): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  return search.toString()
}

export async function fetchBooks(query: BookListQuery): Promise<PaginatedResponse<Book[]>> {
  const response = await httpClient.get<PaginatedResponse<Book[]>>(`/books?${toQueryString(query)}`)
  return response.data
}

export async function fetchBook(id: string): Promise<Book> {
  const response = await httpClient.get<ApiResponse<Book>>(`/books/${id}`)
  return response.data.data
}

export async function deleteBook(id: string): Promise<void> {
  await httpClient.delete(`/books/${id}`)
}

export function buildExportUrl(filters: BookFilters): string {
  const query = toQueryString(filters)
  return query ? `/api/books/export?${query}` : '/api/books/export'
}
