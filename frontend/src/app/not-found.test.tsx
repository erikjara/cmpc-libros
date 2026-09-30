import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createTestQueryClient, renderRoutes } from '@/test/render'
import { createRoutes } from './routes'

describe('rutas desconocidas', () => {
  it('muestran la página 404 dentro del layout', async () => {
    const queryClient = createTestQueryClient()
    renderRoutes(createRoutes(queryClient), { initialEntries: ['/no-existe'], queryClient })
    expect(await screen.findByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })
})
