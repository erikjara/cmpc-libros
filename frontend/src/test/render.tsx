import { QueryClient } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { createMemoryRouter, type RouteObject } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { AppProviders } from '@/app/providers'
import { LocationDisplay } from './LocationDisplay'

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

interface RenderRoutesOptions {
  initialEntries?: string[]
  queryClient?: QueryClient
}

export function renderRoutes(routes: RouteObject[], options: RenderRoutesOptions = {}) {
  const queryClient = options.queryClient ?? createTestQueryClient()
  const router = createMemoryRouter(routes, {
    initialEntries: options.initialEntries ?? ['/'],
  })
  const user = userEvent.setup()
  const result = render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { ...result, user, router, queryClient }
}

interface RenderWithProvidersOptions extends Omit<RenderRoutesOptions, 'initialEntries'> {
  path?: string
  initialEntry?: string
  extraRoutes?: RouteObject[]
}

export function renderWithProviders(ui: ReactElement, options: RenderWithProvidersOptions = {}) {
  const path = options.path ?? '/'
  return renderRoutes(
    [
      { path, element: ui },
      ...(options.extraRoutes ?? []),
      { path: '*', element: <LocationDisplay /> },
    ],
    { initialEntries: [options.initialEntry ?? path], queryClient: options.queryClient },
  )
}
