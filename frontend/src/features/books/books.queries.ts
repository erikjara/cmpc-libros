import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
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
  /** updatedAt del libro cargado al editar; se envía como If-Match. */
  expectedUpdatedAt?: string
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
    mutationFn: async ({ id, expectedUpdatedAt, input, image }: SaveBookVariables): Promise<SaveBookResult> => {
      let book = id ? await updateBook(id, input, expectedUpdatedAt) : await createBook(input)
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
    onError: async (error, { id }) => {
      // 412: otra persona modificó el libro; se recarga el detalle para comparar con la versión actual.
      if (id && error instanceof ApiError && error.status === 412) {
        await queryClient.invalidateQueries({ queryKey: bookKeys.detail(id), exact: true })
      }
    },
  })
}

// Remover una query con un observer montado hace que este la vuelva a crear y a pedir (en el
// detalle, un GET que responde 404). Se remueve cuando se desmonta su último observer.
function removeQueryWhenUnobserved(queryClient: QueryClient, queryKey: QueryKey): void {
  const cache = queryClient.getQueryCache()
  const query = cache.find({ queryKey, exact: true })
  if (!query) return
  if (query.getObserversCount() === 0) {
    cache.remove(query)
    return
  }
  const unsubscribe = cache.subscribe((event) => {
    if (event.query !== query) return
    if (event.type === 'removed' || (event.type === 'observerRemoved' && query.getObserversCount() === 0)) {
      unsubscribe()
      cache.remove(query)
    }
  })
}

export function useDeleteBook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteBook(id),
    onSuccess: async (_data, id) => {
      await queryClient.cancelQueries({ queryKey: bookKeys.detail(id), exact: true })
      removeQueryWhenUnobserved(queryClient, bookKeys.detail(id))
      await queryClient.invalidateQueries({ queryKey: bookKeys.lists() })
    },
  })
}
