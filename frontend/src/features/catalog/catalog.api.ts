import { httpClient } from '@/lib/http-client'
import type { ApiResponse, CatalogItem, CatalogKind } from '@/lib/api-types'

export const CATALOG_MAX_LIMIT = 50

export async function fetchCatalog(kind: CatalogKind, search: string): Promise<CatalogItem[]> {
  const trimmed = search.trim().slice(0, 100)
  const response = await httpClient.get<ApiResponse<CatalogItem[]>>(`/${kind}`, {
    params: { limit: CATALOG_MAX_LIMIT, ...(trimmed ? { search: trimmed } : {}) },
  })
  return response.data.data
}
