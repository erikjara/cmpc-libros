import type { SortingState } from '@tanstack/react-table'
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import type { BookFilters, BookListQuery } from '@/lib/api-types'
import { parseSort, serializeSort } from './sort'

export const DEFAULT_PAGE_SIZE = 10
export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const
const MAX_SEARCH_LENGTH = 100

export type AvailabilityFilter = 'true' | 'false'

export interface BookFilterValues {
  search: string
  authorId?: string
  publisherId?: string
  genreId?: string
  available?: AvailabilityFilter
}

export interface BookSearchState extends BookFilterValues {
  page: number
  limit: number
  sorting: SortingState
}

const FILTER_KEYS = ['search', 'authorId', 'publisherId', 'genreId', 'available'] as const

function parsePositiveInt(raw: string | null, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const value = Number(raw)
  return Number.isInteger(value) && value >= 1 && value <= max ? value : fallback
}

function optional(raw: string | null): string | undefined {
  return raw ? raw : undefined
}

export function parseBookSearchParams(params: URLSearchParams): BookSearchState {
  const available = params.get('available')
  return {
    page: parsePositiveInt(params.get('page'), 1),
    limit: parsePositiveInt(params.get('limit'), DEFAULT_PAGE_SIZE, 100),
    search: (params.get('search') ?? '').slice(0, MAX_SEARCH_LENGTH),
    authorId: optional(params.get('authorId')),
    publisherId: optional(params.get('publisherId')),
    genreId: optional(params.get('genreId')),
    available: available === 'true' || available === 'false' ? available : undefined,
    sorting: parseSort(params.get('sort')),
  }
}

export function toBookFilters(state: BookSearchState): BookFilters {
  const search = state.search.trim()
  return {
    ...(search ? { search } : {}),
    ...(state.authorId ? { authorId: state.authorId } : {}),
    ...(state.publisherId ? { publisherId: state.publisherId } : {}),
    ...(state.genreId ? { genreId: state.genreId } : {}),
    ...(state.available ? { available: state.available } : {}),
    ...(state.sorting.length > 0 ? { sort: serializeSort(state.sorting) } : {}),
  }
}

export function toBookListQuery(state: BookSearchState): BookListQuery {
  return { page: state.page, limit: state.limit, ...toBookFilters(state) }
}

export function useBookSearchParams() {
  const [searchParams, setSearchParams] = useSearchParams()
  const state = useMemo(() => parseBookSearchParams(searchParams), [searchParams])
  const query = useMemo(() => toBookListQuery(state), [state])
  const filters = useMemo(() => toBookFilters(state), [state])

  const update = useCallback(
    (mutate: (next: URLSearchParams) => void, options: { resetPage: boolean; replace?: boolean }) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          mutate(next)
          if (options.resetPage) next.delete('page')
          return next
        },
        { replace: options.replace ?? false },
      )
    },
    [setSearchParams],
  )

  const setPage = useCallback(
    (page: number, options: { replace?: boolean } = {}) =>
      update((next) => (page > 1 ? next.set('page', String(page)) : next.delete('page')), {
        resetPage: false,
        replace: options.replace,
      }),
    [update],
  )

  const setLimit = useCallback(
    (limit: number) =>
      update(
        (next) => (limit === DEFAULT_PAGE_SIZE ? next.delete('limit') : next.set('limit', String(limit))),
        { resetPage: true },
      ),
    [update],
  )

  const setFilters = useCallback(
    (patch: Partial<BookFilterValues>) =>
      update(
        (next) => {
          for (const key of FILTER_KEYS) {
            if (!(key in patch)) continue
            const value = patch[key]
            if (value) next.set(key, value)
            else next.delete(key)
          }
        },
        // Búsqueda y filtros reemplazan la entrada: escribir no debe llenar el historial.
        { resetPage: true, replace: true },
      ),
    [update],
  )

  const setSorting = useCallback(
    (sorting: SortingState) =>
      update(
        (next) => {
          const sort = serializeSort(sorting)
          if (sort) next.set('sort', sort)
          else next.delete('sort')
        },
        { resetPage: true },
      ),
    [update],
  )

  const clearFilters = useCallback(
    () => update((next) => FILTER_KEYS.forEach((key) => next.delete(key)), { resetPage: true, replace: true }),
    [update],
  )

  const hasActiveFilters = FILTER_KEYS.some((key) => Boolean(state[key]))

  return { state, query, filters, setPage, setLimit, setFilters, setSorting, clearFilters, hasActiveFilters }
}
