import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { BookListQuery } from '@/lib/api-types'
import { fetchBooks } from './books.api'

export const bookKeys = {
  all: ['books'] as const,
  lists: () => ['books', 'list'] as const,
  list: (query: BookListQuery) => ['books', 'list', query] as const,
  detail: (id: string) => ['books', 'detail', id] as const,
}

export function useBooksQuery(query: BookListQuery) {
  return useQuery({
    queryKey: bookKeys.list(query),
    queryFn: () => fetchBooks(query),
    placeholderData: keepPreviousData,
  })
}
