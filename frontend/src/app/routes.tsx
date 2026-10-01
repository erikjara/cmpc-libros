import type { QueryClient } from '@tanstack/react-query'
import { redirect, type RouteObject } from 'react-router'
import { createRedirectIfAuthenticatedLoader, createRequireAuthLoader } from '@/features/auth/require-auth'
import { BooksListPage } from '@/features/books/BooksListPage'
import { FullPageLoader } from '@/shared/FullPageLoader'
import { NotFoundPage } from '@/shared/NotFoundPage'
import { RouteErrorBoundary } from '@/shared/RouteErrorBoundary'
import { AppLayout } from './AppLayout'

// El listado (página de entrada) y el layout van en el bundle principal; el resto de las
// páginas se descargan al navegar a ellas.
const loadBookForm = async () => (await import('@/features/books/BookFormPage')).BookFormPage

export function createRoutes(queryClient: QueryClient): RouteObject[] {
  return [
    {
      path: '/login',
      loader: createRedirectIfAuthenticatedLoader(queryClient),
      lazy: { Component: async () => (await import('@/features/auth/LoginPage')).LoginPage },
      errorElement: <RouteErrorBoundary fullPage />,
      hydrateFallbackElement: <FullPageLoader />,
    },
    {
      path: '/',
      loader: createRequireAuthLoader(queryClient),
      element: <AppLayout />,
      errorElement: <RouteErrorBoundary fullPage />,
      hydrateFallbackElement: <FullPageLoader />,
      children: [
        {
          errorElement: <RouteErrorBoundary />,
          children: [
            { index: true, loader: () => redirect('/books') },
            { path: 'books', element: <BooksListPage /> },
            { path: 'books/new', lazy: { Component: loadBookForm } },
            { path: 'books/:id', lazy: { Component: async () => (await import('@/features/books/BookDetailPage')).BookDetailPage } },
            { path: 'books/:id/edit', lazy: { Component: loadBookForm } },
            { path: 'trash', lazy: { Component: async () => (await import('@/features/trash/TrashPage')).TrashPage } },
            { path: 'audit', lazy: { Component: async () => (await import('@/features/audit/AuditPage')).AuditPage } },
            { path: '*', element: <NotFoundPage /> },
          ],
        },
      ],
    },
  ]
}
