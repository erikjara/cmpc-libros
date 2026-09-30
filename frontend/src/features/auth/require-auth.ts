import type { QueryClient } from '@tanstack/react-query'
import { redirect, type LoaderFunctionArgs } from 'react-router'
import { ApiError } from '@/lib/api-error'
import { sessionQueryOptions } from './session'

export function buildLoginPath(redirectTo: string): string {
  return `/login?${new URLSearchParams({ redirectTo }).toString()}`
}

// Solo se aceptan rutas internas para evitar redirecciones abiertas.
export function safeRedirectTarget(value: string | null): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) return value
  return '/books'
}

export function createRequireAuthLoader(queryClient: QueryClient) {
  return async function requireAuth({ request }: LoaderFunctionArgs) {
    try {
      return await queryClient.ensureQueryData(sessionQueryOptions)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        const url = new URL(request.url)
        throw redirect(buildLoginPath(`${url.pathname}${url.search}`))
      }
      throw error
    }
  }
}

export function createRedirectIfAuthenticatedLoader(queryClient: QueryClient) {
  return async function redirectIfAuthenticated({ request }: LoaderFunctionArgs) {
    try {
      await queryClient.ensureQueryData(sessionQueryOptions)
    } catch {
      return null
    }
    const url = new URL(request.url)
    throw redirect(safeRedirectTarget(url.searchParams.get('redirectTo')))
  }
}
