import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { ApiError } from '@/lib/api-error'
import type { Book, BookInput, BookListQuery, TrashListQuery } from '@/lib/api-types'
import { catalogKeys } from '@/features/catalog/catalog.queries'
import {
  createBook,
  deleteBook,
  fetchBook,
  fetchBooks,
  fetchTrash,
  restoreBook,
  updateBook,
  uploadBookImage,
} from './books.api'

export const bookKeys = {
  all: ['books'] as const,
  lists: () => ['books', 'list'] as const,
  list: (query: BookListQuery) => ['books', 'list', query] as const,
  trashLists: () => ['books', 'trash'] as const,
  trash: (query: TrashListQuery) => ['books', 'trash', query] as const,
  detail: (id: string) => ['books', 'detail', id] as const,
}

export function useBooksQuery(query: BookListQuery) {
  return useQuery({
    queryKey: bookKeys.list(query),
    queryFn: () => fetchBooks(query),
    placeholderData: keepPreviousData,
  })
}

export function useTrashQuery(query: TrashListQuery) {
  return useQuery({
    queryKey: bookKeys.trash(query),
    queryFn: () => fetchTrash(query),
    placeholderData: keepPreviousData,
  })
}

export function useBookQuery(id: string) {
  return useQuery({
    queryKey: bookKeys.detail(id),
    queryFn: () => fetchBook(id),
  })
}

// Para editar: pide siempre la versión vigente al montar, aunque haya una copia en caché sin vencer.
export function useFreshBookQuery(id: string) {
  return useQuery({
    queryKey: bookKeys.detail(id),
    queryFn: () => fetchBook(id),
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

export type SaveBookVariables =
  | { id?: undefined; input: BookInput; image: File | null }
  | {
      id: string
      /** updatedAt de la versión que pobló el formulario; se envía como If-Match. */
      expectedUpdatedAt: string
      /** Solo los campos que el usuario modificó. */
      changes: Partial<BookInput>
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
    mutationFn: async (variables: SaveBookVariables): Promise<SaveBookResult> => {
      const { image } = variables
      if (variables.id !== undefined && Object.keys(variables.changes).length === 0) {
        // Solo cambió la portada: la API exige al menos un campo en el PATCH, así que se sube la
        // imagen directamente; si falla no se guardó nada y la mutación falla.
        if (!image) throw new ApiError(0, 'No hay cambios para guardar')
        return { book: await uploadBookImage(variables.id, image), imageError: null }
      }
      let book =
        variables.id === undefined
          ? await createBook(variables.input)
          : await updateBook(variables.id, variables.changes, variables.expectedUpdatedAt)
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
      // 412: otra persona modificó el libro; se actualiza la caché del detalle. El formulario abierto
      // no la adopta solo: espera a que el usuario pida recargar la versión actual.
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: bookKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: bookKeys.trashLists() }),
      ])
    },
  })
}

// Restaurar mueve el libro de la papelera al inventario: cambian ambos listados. Es una función
// (no solo un hook) para que el "Deshacer" del toast funcione aunque la página ya se haya desmontado.
export async function restoreBookAndRefresh(queryClient: QueryClient, id: string): Promise<Book> {
  const book = await restoreBook(id)
  queryClient.setQueryData(bookKeys.detail(book.id), book)
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: bookKeys.lists() }),
    queryClient.invalidateQueries({ queryKey: bookKeys.trashLists() }),
  ])
  return book
}

export function useRestoreBook() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: (id: string) => restoreBookAndRefresh(queryClient, id) })
}
