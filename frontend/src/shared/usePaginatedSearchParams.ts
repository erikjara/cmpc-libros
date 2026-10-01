import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { DEFAULT_PAGE_SIZE, MAX_PAGE, parsePositiveInt } from './pagination'

interface UpdateOptions {
  resetPage: boolean
  replace?: boolean
}

/** Página y tamaño de página de un listado guardados en la URL, más parámetros propios del listado. */
export function usePaginatedSearchParams() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePositiveInt(searchParams.get('page'), 1, MAX_PAGE)
  const limit = parsePositiveInt(searchParams.get('limit'), DEFAULT_PAGE_SIZE, 100)

  const update = useCallback(
    (mutate: (next: URLSearchParams) => void, { resetPage, replace = false }: UpdateOptions) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          mutate(next)
          if (resetPage) next.delete('page')
          return next
        },
        { replace },
      )
    },
    [setSearchParams],
  )

  const setPage = useCallback(
    (nextPage: number, options: { replace?: boolean } = {}) =>
      update((next) => (nextPage > 1 ? next.set('page', String(nextPage)) : next.delete('page')), {
        resetPage: false,
        replace: options.replace,
      }),
    [update],
  )

  const setLimit = useCallback(
    (nextLimit: number) =>
      update(
        (next) => (nextLimit === DEFAULT_PAGE_SIZE ? next.delete('limit') : next.set('limit', String(nextLimit))),
        { resetPage: true },
      ),
    [update],
  )

  // Filtros y búsqueda reemplazan la entrada: escribir no debe llenar el historial.
  const setParam = useCallback(
    (key: string, value: string | undefined) =>
      update((next) => (value ? next.set(key, value) : next.delete(key)), { resetPage: true, replace: true }),
    [update],
  )

  return { searchParams, page, limit, setPage, setLimit, setParam }
}
