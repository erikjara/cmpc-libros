import type { QueryClient } from '@tanstack/react-query'
import { redirect, type RouteObject } from 'react-router'
import { LoginPage } from '@/features/auth/LoginPage'
import { createRedirectIfAuthenticatedLoader, createRequireAuthLoader } from '@/features/auth/require-auth'
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
      ],
    },
  ]
}
