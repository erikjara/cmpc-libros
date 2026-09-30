import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { db } from '@/test/msw/db'
import { buildBooks } from '@/test/msw/fixtures'
import { errorBody } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { BookDetailPage } from './BookDetailPage'

const [withImage, soldOut] = buildBooks()

function renderDetail(id: string) {
  return renderWithProviders(<BookDetailPage />, { path: '/books/:id', initialEntry: `/books/${id}` })
}

describe('BookDetailPage', () => {
  it('muestra todos los datos del libro con precio en CLP y portada', async () => {
    renderDetail(withImage.id)
    expect(screen.getByTestId('book-skeleton')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Cien años de soledad' })).toBeInTheDocument()
    expect(screen.getByText('Gabriel García Márquez')).toBeInTheDocument()
    expect(screen.getByText('Editorial Sudamericana')).toBeInTheDocument()
    expect(screen.getByText('Novela')).toBeInTheDocument()
    expect(screen.getByText('$15.990')).toBeInTheDocument()
    expect(screen.getByText('Disponible (5)')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Portada de Cien años de soledad' })).toHaveAttribute(
      'src',
      '/api/uploads/cien-anos.webp',
    )
    expect(screen.getByRole('link', { name: 'Editar' })).toHaveAttribute('href', `/books/${withImage.id}/edit`)
  })

  it('muestra un placeholder sin imagen y el chip Agotado', async () => {
    renderDetail(soldOut.id)
    expect(await screen.findByRole('img', { name: 'Sin portada' })).toBeInTheDocument()
    expect(screen.getByText('Agotado')).toBeInTheDocument()
  })

  it('muestra "Libro no encontrado" ante un 404', async () => {
    renderDetail('40000000-0000-4000-8000-999999999999')
    expect(await screen.findByRole('heading', { name: 'Libro no encontrado' })).toBeInTheDocument()
  })

  it('muestra un error con "Reintentar" ante fallos del servidor', async () => {
    server.use(
      http.get('/api/books/:id', () =>
        HttpResponse.json(errorBody(500, 'Internal Server Error', 'Error interno del servidor'), { status: 500 }),
      ),
    )
    renderDetail(withImage.id)
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('elimina tras confirmar, muestra un toast y vuelve al listado', async () => {
    const { user } = renderDetail(withImage.id)
    await user.click(await screen.findByRole('button', { name: 'Eliminar' }))
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('¿Eliminar este libro?')
    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(await screen.findByText('Libro eliminado')).toBeInTheDocument()
    expect(await screen.findByTestId('location')).toHaveTextContent('/books')
    expect(db.books.some((book) => book.id === withImage.id)).toBe(false)
  })

  it('no elimina si se cancela la confirmación', async () => {
    const { user } = renderDetail(withImage.id)
    await user.click(await screen.findByRole('button', { name: 'Eliminar' }))
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(db.books.some((book) => book.id === withImage.id)).toBe(true)
  })

  it('muestra un toast de error si la eliminación falla', async () => {
    server.use(
      http.delete('/api/books/:id', () =>
        HttpResponse.json(errorBody(404, 'Not Found', 'Recurso no encontrado'), { status: 404 }),
      ),
    )
    const { user } = renderDetail(withImage.id)
    await user.click(await screen.findByRole('button', { name: 'Eliminar' }))
    await screen.findByRole('alertdialog')
    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(await screen.findByText('Recurso no encontrado')).toBeInTheDocument()
  })
})
