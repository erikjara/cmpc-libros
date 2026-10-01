import type { QueryClient } from '@tanstack/react-query'
import { redirect, type LoaderFunctionArgs } from 'react-router'
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
    const user = await queryClient.ensureQueryData(sessionQueryOptions)
    if (!user) {
      const url = new URL(request.url)
      throw redirect(buildLoginPath(`${url.pathname}${url.search}`))
    }
    return user
  }
}

export function createRedirectIfAuthenticatedLoader(queryClient: QueryClient) {
  return async function redirectIfAuthenticated({ request }: LoaderFunctionArgs) {
    // Si no se puede comprobar la sesión (p. ej. error de red) se muestra el formulario igualmente.
    const user = await queryClient.ensureQueryData(sessionQueryOptions).catch(() => null)
    if (!user) return null
    const url = new URL(request.url)
    throw redirect(safeRedirectTarget(url.searchParams.get('redirectTo')))
  }
}
