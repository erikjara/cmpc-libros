import { screen } from '@testing-library/react'
import { data } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { renderRoutes } from '@/test/render'
import { RouteErrorBoundary } from './RouteErrorBoundary'

function Boom(): never {
  throw new Error('fallo de render')
}

describe('RouteErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks())

  it('muestra un mensaje genérico ante errores de render', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderRoutes([{ path: '/', element: <Boom />, errorElement: <RouteErrorBoundary /> }])
    expect(await screen.findByRole('heading', { name: 'Algo salió mal' })).toBeInTheDocument()
    expect(screen.getByText('Ocurrió un error inesperado.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir al listado' })).toHaveAttribute('href', '/books')
    // Dentro del layout (por defecto) no agrega un <main> anidado.
    expect(screen.queryByRole('main')).not.toBeInTheDocument()
  })

  it('a pantalla completa usa <main> también para la página 404', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderRoutes([
      {
        path: '/',
        loader: () => {
          throw data(null, { status: 404 })
        },
        element: <p>nunca</p>,
        errorElement: <RouteErrorBoundary fullPage />,
      },
    ])
    expect(await screen.findByRole('main')).toHaveTextContent('Página no encontrada')
  })

  it('muestra el mensaje de un ApiError lanzado por un loader', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderRoutes([
      {
        path: '/',
        loader: () => {
          throw new ApiError(500, 'Error interno del servidor')
        },
        element: <p>nunca</p>,
        errorElement: <RouteErrorBoundary />,
      },
    ])
    expect(await screen.findByText('Error interno del servidor')).toBeInTheDocument()
  })

  it('muestra la página 404 ante respuestas 404', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderRoutes([
      {
        path: '/',
        loader: () => {
          throw data(null, { status: 404 })
        },
        element: <p>nunca</p>,
        errorElement: <RouteErrorBoundary />,
      },
    ])
    expect(await screen.findByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument()
  })
})
