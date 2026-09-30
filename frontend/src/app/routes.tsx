import type { QueryClient } from '@tanstack/react-query'
import { redirect, type RouteObject } from 'react-router'
import { LoginPage } from '@/features/auth/LoginPage'
import { createRedirectIfAuthenticatedLoader, createRequireAuthLoader } from '@/features/auth/require-auth'
import { BookDetailPage } from '@/features/books/BookDetailPage'
import { BookFormPage } from '@/features/books/BookFormPage'
import { BooksListPage } from '@/features/books/BooksListPage'
import { FullPageLoader } from '@/shared/FullPageLoader'
import { AppLayout } from './AppLayout'

export function createRoutes(queryClient: QueryClient): RouteObject[] {
  return [
    {
      path: '/login',
      loader: createRedirectIfAuthenticatedLoader(queryClient),
      element: <LoginPage />,
      hydrateFallbackElement: <FullPageLoader />,
    },
    {
      path: '/',
      loader: createRequireAuthLoader(queryClient),
      element: <AppLayout />,
      hydrateFallbackElement: <FullPageLoader />,
      children: [
        { index: true, loader: () => redirect('/books') },
        { path: 'books', element: <BooksListPage /> },
        { path: 'books/new', element: <BookFormPage /> },
        { path: 'books/:id', element: <BookDetailPage /> },
        { path: 'books/:id/edit', element: <BookFormPage /> },
      ],
    },
  ]
}
