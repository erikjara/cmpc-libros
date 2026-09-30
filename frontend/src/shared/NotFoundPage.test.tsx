import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { NotFoundPage } from './NotFoundPage'

describe('NotFoundPage', () => {
  it('ofrece volver al listado', async () => {
    const { user } = renderWithProviders(<NotFoundPage />, { path: '/no-existe' })
    await user.click(screen.getByRole('link', { name: 'Volver al listado' }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/books')
  })
})
