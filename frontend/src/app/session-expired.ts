import type { QueryClient } from '@tanstack/react-query'
import type { DataRouter } from 'react-router'
import { toast } from 'sonner'
import { buildLoginPath } from '@/features/auth/require-auth'
import { sessionQueryKey } from '@/features/auth/session'
import { setUnauthorizedHandler } from '@/lib/http-client'

export const SESSION_EXPIRED_MESSAGE = 'Tu sesión expiró. Ingresa nuevamente.'

export function installSessionExpiredHandler(queryClient: QueryClient, router: DataRouter): () => void {
  setUnauthorizedHandler(() => {
    const { pathname, search } = router.state.location
    if (pathname === '/login') return
    queryClient.removeQueries({ queryKey: sessionQueryKey })
    toast.error(SESSION_EXPIRED_MESSAGE, { id: 'session-expired' })
    void router.navigate(buildLoginPath(`${pathname}${search}`), { replace: true })
  })
  return () => setUnauthorizedHandler(null)
}
