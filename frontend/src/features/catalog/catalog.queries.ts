import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { CatalogKind } from '@/lib/api-types'
import { fetchCatalog } from './catalog.api'

export const catalogKeys = {
  all: ['catalog'] as const,
  list: (kind: CatalogKind, search: string) => ['catalog', kind, search.trim()] as const,
}

export function useCatalogOptions(kind: CatalogKind, search: string) {
  return useQuery({
    queryKey: catalogKeys.list(kind, search),
    queryFn: () => fetchCatalog(kind, search),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}
