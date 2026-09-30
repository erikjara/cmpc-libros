import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db } from '@/test/msw/db'
import { LocationDisplay } from '@/test/LocationDisplay'
import { createTestQueryClient, renderRoutes } from '@/test/render'
import {
  buildLoginPath,
  createRedirectIfAuthenticatedLoader,
  createRequireAuthLoader,
  safeRedirectTarget,
} from './require-auth'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { errorBody } from '@/test/msw/handlers'

function buildRoutes() {
  const queryClient = createTestQueryClient()
  const routes = [
    { path: '/login', loader: createRedirectIfAuthenticatedLoader(queryClient), element: <LocationDisplay /> },
    {
      loader: createRequireAuthLoader(queryClient),
      errorElement: <p>Error de carga</p>,
      children: [{ path: '/books', element: <p>Listado protegido</p> }],
    },
  ]
  return { routes, queryClient }
}

describe('buildLoginPath / safeRedirectTarget', () => {
  it('codifica la ruta de origen en redirectTo', () => {
    expect(buildLoginPath('/books?page=2')).toBe('/login?redirectTo=%2Fbooks%3Fpage%3D2')
  })

  it('solo acepta rutas internas', () => {
    expect(safeRedirectTarget('/books/1')).toBe('/books/1')
    expect(safeRedirectTarget('//evil.com')).toBe('/books')
    expect(safeRedirectTarget('https://evil.com')).toBe('/books')
    expect(safeRedirectTarget(null)).toBe('/books')
  })

  it('rechaza barras invertidas y caracteres de control', () => {
    expect(safeRedirectTarget('/\\evil.com')).toBe('/books')
    expect(safeRedirectTarget('/books\\..')).toBe('/books')
    expect(safeRedirectTarget('/\t/evil.com')).toBe('/books')
    expect(safeRedirectTarget('/books\n')).toBe('/books')
    expect(safeRedirectTarget('/books\u0000')).toBe('/books')
    expect(safeRedirectTarget('/books\u007f')).toBe('/books')
    expect(safeRedirectTarget('/books?search=cien%20a%C3%B1os')).toBe('/books?search=cien%20a%C3%B1os')
  })
})

describe('requireAuth', () => {
  it('renderiza la ruta protegida con sesión válida', async () => {
    const { routes, queryClient } = buildRoutes()
    renderRoutes(routes, { initialEntries: ['/books'], queryClient })
    expect(await screen.findByText('Listado protegido')).toBeInTheDocument()
  })

  it('redirige a /login recordando la ruta de origen sin sesión', async () => {
    db.sessionUser = null
    const { routes, queryClient } = buildRoutes()
    renderRoutes(routes, { initialEntries: ['/books?page=2'], queryClient })
    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/login?redirectTo=%2Fbooks%3Fpage%3D2',
    )
  })

  it('propaga errores que no son 401 al errorElement', async () => {
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json(errorBody(500, 'Internal Server Error', 'Error interno del servidor'), {
          status: 500,
        }),
      ),
    )
    const { routes, queryClient } = buildRoutes()
    renderRoutes(routes, { initialEntries: ['/books'], queryClient })
    expect(await screen.findByText('Error de carga')).toBeInTheDocument()
  })
})

describe('redirectIfAuthenticated', () => {
  it('envía al usuario con sesión a redirectTo', async () => {
    const { routes, queryClient } = buildRoutes()
    const { router } = renderRoutes(routes, {
      initialEntries: ['/login?redirectTo=%2Fbooks'],
      queryClient,
    })
    expect(await screen.findByText('Listado protegido')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/books')
  })

  it('muestra /login si no hay sesión', async () => {
    db.sessionUser = null
    const { routes, queryClient } = buildRoutes()
    renderRoutes(routes, { initialEntries: ['/login'], queryClient })
    expect(await screen.findByTestId('location')).toHaveTextContent('/login')
  })
})
