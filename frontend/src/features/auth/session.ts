import { queryOptions, useQuery } from '@tanstack/react-query'
import type { User } from '@/lib/api-types'
import { ApiError } from '@/lib/api-error'
import { fetchMe } from './auth.api'

export const sessionQueryKey = ['auth', 'me'] as const

// "Sin sesión" (401) es un resultado válido y se guarda como null: si se guardara como error, la
// query quedaría sin datos y el loader de /login volvería a pedir /auth/me tras la redirección.
async function fetchSession(): Promise<User | null> {
  try {
    return await fetchMe()
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export const sessionQueryOptions = queryOptions({
  queryKey: sessionQueryKey,
  queryFn: fetchSession,
  staleTime: 5 * 60_000,
  retry: false,
})

export function useSession() {
  return useQuery(sessionQueryOptions)
}
