import type { QueryClient } from '@tanstack/react-query'
import type { DataRouter } from 'react-router'
import { toast } from 'sonner'
import { buildLoginPath } from '@/features/auth/require-auth'
import { setUnauthorizedHandler } from '@/lib/http-client'

export const SESSION_EXPIRED_MESSAGE = 'Tu sesión expiró. Ingresa nuevamente.'

export function installSessionExpiredHandler(queryClient: QueryClient, router: DataRouter): () => void {
  // Varias requests pueden recibir 401 a la vez: solo la primera redirige. La bandera se libera
  // al llegar a /login (o si la navegación termina de otro modo).
  let redirecting = false
  setUnauthorizedHandler(() => {
    const { pathname, search } = router.state.location
    if (redirecting || pathname === '/login') return
    redirecting = true
    // Los datos en caché pertenecen a la sesión anterior: no deben mostrarse tras reingresar.
    queryClient.clear()
    toast.error(SESSION_EXPIRED_MESSAGE, { id: 'session-expired' })
    void router.navigate(buildLoginPath(`${pathname}${search}`), { replace: true }).finally(() => {
      redirecting = false
    })
  })
  return () => setUnauthorizedHandler(null)
}
