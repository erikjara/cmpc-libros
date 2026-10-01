import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter } from 'react-router'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { httpClient } from '@/lib/http-client'
import { db } from '@/test/msw/db'
import { errorBody } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { createTestQueryClient, renderRoutes } from '@/test/render'
import { buildBooks } from '@/test/msw/fixtures'
import { createRoutes } from './routes'
import { installSessionExpiredHandler, SESSION_EXPIRED_MESSAGE } from './session-expired'

function countRequests(pathname: string): () => number {
  let count = 0
  const listener = ({ request }: { request: Request }) => {
    if (new URL(request.url).pathname === pathname) count += 1
  }
  server.events.on('request:start', listener)
  onTestFinished(() => server.events.removeListener('request:start', listener))
  return () => count
}

function renderApp(initialEntry: string) {
  const queryClient = createTestQueryClient()
  const utils = renderRoutes(createRoutes(queryClient), { initialEntries: [initialEntry], queryClient })
  installSessionExpiredHandler(utils.queryClient, utils.router)
  return utils
}

describe('rutas de la aplicación', () => {
  it('redirige / a /books y muestra el layout con el usuario', async () => {
    const { router } = renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Libros' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/books')
    expect(await screen.findByText('Administrador')).toBeInTheDocument()
  })

  it('el header navega entre Libros, Papelera y Auditoría marcando la sección activa', async () => {
    const [book] = buildBooks()
    const { user, router } = renderApp(`/books/${book.id}`)
    const nav = await screen.findByRole('navigation', { name: 'Principal' })
    const link = (name: string) => within(nav).getByRole('link', { name })
    expect(link('Libros')).toHaveAttribute('aria-current', 'page')
    expect(link('Papelera')).not.toHaveAttribute('aria-current')
    await user.click(link('Papelera'))
    expect(await screen.findByRole('heading', { name: 'Papelera' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/trash')
    expect(link('Papelera')).toHaveAttribute('aria-current', 'page')
    expect(link('Libros')).not.toHaveAttribute('aria-current')
    await user.click(link('Auditoría'))
    expect(await screen.findByRole('heading', { name: 'Auditoría' })).toBeInTheDocument()
    expect(link('Auditoría')).toHaveAttribute('aria-current', 'page')
  })

  it('muestra la papelera en /trash dentro del layout', async () => {
    renderApp('/trash')
    expect(await screen.findByRole('heading', { name: 'Papelera' })).toBeInTheDocument()
    expect(await screen.findByText('La papelera está vacía')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })

  it('muestra la auditoría en /audit dentro del layout', async () => {
    renderApp('/audit')
    expect(await screen.findByRole('heading', { name: 'Auditoría' })).toBeInTheDocument()
    expect(await screen.findByText('16 registros · Página 1 de 2')).toBeInTheDocument()
  })

  it('envía a /login sin sesión y vuelve a la ruta original tras iniciar sesión', async () => {
    db.sessionUser = null
    const { user, router } = renderApp('/books?page=2')
    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?redirectTo=%2Fbooks%3Fpage%3D2')
    await user.type(screen.getByLabelText('Correo'), 'admin@cmpc.cl')
    await user.type(screen.getByLabelText('Contraseña'), 'Admin123!')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))
    expect(await screen.findByRole('heading', { name: 'Libros' })).toBeInTheDocument()
    expect(`${router.state.location.pathname}${router.state.location.search}`).toBe('/books?page=2')
  })

  it('sin sesión consulta /api/auth/me una sola vez al redirigir a /login', async () => {
    db.sessionUser = null
    const meRequests = countRequests('/api/auth/me')
    renderApp('/books')
    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument()
    expect(meRequests()).toBe(1)
  })

  it('cierra sesión y vuelve a /login', async () => {
    const { user, router } = renderApp('/books')
    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(db.sessionUser).toBeNull()
  })

  it('muestra un toast si el cierre de sesión falla', async () => {
    server.use(
      http.post('/api/auth/logout', () =>
        HttpResponse.json(errorBody(500, 'Internal Server Error', 'Error interno del servidor'), { status: 500 }),
      ),
    )
    const { user } = renderApp('/books')
    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByText('Error interno del servidor')).toBeInTheDocument()
  })

  it('ante un 401 en plena sesión avisa y redirige a /login recordando la ruta', async () => {
    const { router } = renderApp('/books?page=3')
    await screen.findByRole('heading', { name: 'Libros' })
    db.sessionUser = null
    await httpClient.get('/books').catch(() => undefined)
    expect(await screen.findByText(SESSION_EXPIRED_MESSAGE)).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(router.state.location.search).toBe('?redirectTo=%2Fbooks%3Fpage%3D3')
  })
})

describe('sesión expirada', () => {
  it('ante un 401 limpia toda la caché de datos, no solo la sesión', async () => {
    const { queryClient, router } = renderApp('/books')
    await screen.findByRole('heading', { name: 'Libros' })
    queryClient.setQueryData(['books', 'detail', 'x'], { id: 'x' })
    db.sessionUser = null
    await httpClient.get('/books').catch(() => undefined)
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(queryClient.getQueryData(['books', 'detail', 'x'])).toBeUndefined()
    expect(queryClient.getQueriesData({ queryKey: ['books'] }).every(([, data]) => data === undefined)).toBe(true)
  })

  it('varios 401 simultáneos provocan una sola navegación a /login', async () => {
    const { router, user } = renderApp('/books')
    await screen.findByRole('heading', { name: 'Libros' })
    const navigate = vi.spyOn(router, 'navigate')
    db.sessionUser = null
    await Promise.all([
      httpClient.get('/books').catch(() => undefined),
      httpClient.get('/authors').catch(() => undefined),
    ])
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(navigate).toHaveBeenCalledTimes(1)

    // Al llegar a /login se libera la bandera: una nueva expiración vuelve a redirigir.
    await user.type(await screen.findByLabelText('Correo'), 'admin@cmpc.cl')
    await user.type(screen.getByLabelText('Contraseña'), 'Admin123!')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))
    await screen.findByRole('heading', { name: 'Libros' })
    navigate.mockClear()
    db.sessionUser = null
    await httpClient.get('/books').catch(() => undefined)
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(navigate).toHaveBeenCalledTimes(1)
  })
})

describe('errores de ruta', () => {
  it('fuera del layout se muestran a pantalla completa con su propio <main>', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json(errorBody(500, 'Internal Server Error', 'Error interno del servidor'), { status: 500 }),
      ),
    )
    renderApp('/books')
    expect(await screen.findByRole('heading', { name: 'Algo salió mal' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('Error interno del servidor')
    vi.restoreAllMocks()
  })
})

describe('installSessionExpiredHandler', () => {
  it('ignora el 401 si ya se está en /login', async () => {
    const router = createMemoryRouter([{ path: '/login', element: null }], { initialEntries: ['/login'] })
    const uninstall = installSessionExpiredHandler(createTestQueryClient(), router)
    db.sessionUser = null
    await httpClient.get('/books').catch(() => undefined)
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toBe('')
    uninstall()
  })
})
