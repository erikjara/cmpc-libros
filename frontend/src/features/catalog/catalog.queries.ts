import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import type { CatalogKind } from '@/lib/api-types'
import { fetchCatalog } from './catalog.api'

export const catalogKeys = {
  all: ['catalog'] as const,
  list: (kind: CatalogKind, search: string) => ['catalog', kind, search.trim()] as const,
}

export function catalogQueryOptions(kind: CatalogKind, search: string) {
  return queryOptions({
    queryKey: catalogKeys.list(kind, search),
    queryFn: () => fetchCatalog(kind, search),
    staleTime: 60_000,
  })
}

export function useCatalogOptions(kind: CatalogKind, search: string) {
  return useQuery({ ...catalogQueryOptions(kind, search), placeholderData: keepPreviousData })
}
