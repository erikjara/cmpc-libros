import type { QueryClient } from '@tanstack/react-query'
import { redirect, type LoaderFunctionArgs } from 'react-router'
import { ApiError } from '@/lib/api-error'
import { sessionQueryOptions } from './session'

export function buildLoginPath(redirectTo: string): string {
  return `/login?${new URLSearchParams({ redirectTo }).toString()}`
}

// Barras invertidas (los navegadores las tratan como "/") y caracteres de control (se eliminan
// al parsear la URL, p. ej. "/\t/evil.com" → "//evil.com") permitirían salir del sitio.
// oxlint-disable-next-line no-control-regex -- se buscan justamente caracteres de control
const UNSAFE_REDIRECT_CHARS = /[\\\u0000-\u001f\u007f]/

// Solo se aceptan rutas internas para evitar redirecciones abiertas.
export function safeRedirectTarget(value: string | null): string {
  if (value && value.startsWith('/') && !value.startsWith('//') && !UNSAFE_REDIRECT_CHARS.test(value)) {
    return value
  }
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
