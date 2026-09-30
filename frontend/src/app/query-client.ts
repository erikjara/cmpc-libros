import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api-error'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Los 4xx no mejoran reintentando; solo se reintentan fallos de red o 5xx.
        retry: (failureCount, error) =>
          failureCount < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      },
    },
  })
}
