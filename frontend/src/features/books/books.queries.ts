import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { BookListQuery } from '@/lib/api-types'
import { deleteBook, fetchBook, fetchBooks } from './books.api'

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

export function useBookQuery(id: string) {
  return useQuery({
    queryKey: bookKeys.detail(id),
    queryFn: () => fetchBook(id),
  })
}

export function useDeleteBook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteBook(id),
    onSuccess: async (_data, id) => {
      queryClient.removeQueries({ queryKey: bookKeys.detail(id) })
      await queryClient.invalidateQueries({ queryKey: bookKeys.lists() })
    },
  })
}
