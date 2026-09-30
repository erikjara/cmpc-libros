import { queryOptions, useQuery } from '@tanstack/react-query'
import { fetchMe } from './auth.api'

export const sessionQueryKey = ['auth', 'me'] as const

export const sessionQueryOptions = queryOptions({
  queryKey: sessionQueryKey,
  queryFn: fetchMe,
  staleTime: 5 * 60_000,
  retry: false,
})

export function useSession() {
  return useQuery(sessionQueryOptions)
}
