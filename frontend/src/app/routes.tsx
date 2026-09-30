import type { QueryClient } from '@tanstack/react-query'
import { redirect, type RouteObject } from 'react-router'
import { LoginPage } from '@/features/auth/LoginPage'
import { createRedirectIfAuthenticatedLoader, createRequireAuthLoader } from '@/features/auth/require-auth'
import { BookDetailPage } from '@/features/books/BookDetailPage'
import { BookFormPage } from '@/features/books/BookFormPage'
import { BooksListPage } from '@/features/books/BooksListPage'
import { FullPageLoader } from '@/shared/FullPageLoader'
import { NotFoundPage } from '@/shared/NotFoundPage'
import { RouteErrorBoundary } from '@/shared/RouteErrorBoundary'
import { AppLayout } from './AppLayout'

export function createRoutes(queryClient: QueryClient): RouteObject[] {
  return [
    {
      path: '/login',
      loader: createRedirectIfAuthenticatedLoader(queryClient),
      element: <LoginPage />,
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
            { path: 'books/new', element: <BookFormPage /> },
            { path: 'books/:id', element: <BookDetailPage /> },
            { path: 'books/:id/edit', element: <BookFormPage /> },
            { path: '*', element: <NotFoundPage /> },
          ],
        },
      ],
    },
  ]
}
