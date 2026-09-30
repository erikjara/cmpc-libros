import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api-error'
import type { Book, BookInput, BookListQuery } from '@/lib/api-types'
import { catalogKeys } from '@/features/catalog/catalog.queries'
import { createBook, deleteBook, fetchBook, fetchBooks, updateBook, uploadBookImage } from './books.api'

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

export interface SaveBookVariables {
  id?: string
  input: BookInput
  image: File | null
}

export interface SaveBookResult {
  book: Book
  imageError: ApiError | null
}

// Guarda el libro y, si hay imagen, la sube en una segunda request. Si la imagen falla el libro
// ya quedó guardado: se informa con imageError en lugar de rechazar la mutación.
export function useSaveBook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input, image }: SaveBookVariables): Promise<SaveBookResult> => {
      let book = id ? await updateBook(id, input) : await createBook(input)
      let imageError: ApiError | null = null
      if (image) {
        try {
          book = await uploadBookImage(book.id, image)
        } catch (error) {
          imageError = error instanceof ApiError ? error : new ApiError(0, 'No se pudo subir la imagen')
        }
      }
      return { book, imageError }
    },
    onSuccess: async ({ book }) => {
      queryClient.setQueryData(bookKeys.detail(book.id), book)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: bookKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: catalogKeys.all }),
      ])
    },
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
