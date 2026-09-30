import type { QueryClient } from '@tanstack/react-query'
import { createBrowserRouter, type DataRouter } from 'react-router'
import { createRoutes } from './routes'
import { installSessionExpiredHandler } from './session-expired'

export function createAppRouter(queryClient: QueryClient): DataRouter {
  const router = createBrowserRouter(createRoutes(queryClient))
  installSessionExpiredHandler(queryClient, router)
  return router
}
