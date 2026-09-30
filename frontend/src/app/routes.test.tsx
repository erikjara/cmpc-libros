import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { httpClient } from '@/lib/http-client'
import { db } from '@/test/msw/db'
import { errorBody } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { createTestQueryClient, renderRoutes } from '@/test/render'
import { createRoutes } from './routes'
import { installSessionExpiredHandler, SESSION_EXPIRED_MESSAGE } from './session-expired'

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
