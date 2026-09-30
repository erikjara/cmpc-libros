import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { db } from '@/test/msw/db'
import { buildBooks } from '@/test/msw/fixtures'
import { errorBody } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { BookDetailPage } from './BookDetailPage'
import { bookKeys } from './books.queries'

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
    expect(db.deletedBookIds.has(withImage.id)).toBe(true)
  })

  it('tras eliminar no vuelve a pedir el libro ni muestra "Libro no encontrado"', async () => {
    const requests: string[] = []
    const record = ({ request }: { request: Request }) => {
      requests.push(`${request.method} ${new URL(request.url).pathname}`)
    }
    server.events.on('request:start', record)
    const { user, queryClient } = renderDetail(withImage.id)
    await user.click(await screen.findByRole('button', { name: 'Eliminar' }))
    await screen.findByRole('alertdialog')
    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/books')
    await new Promise((resolve) => setTimeout(resolve, 50))
    server.events.removeListener('request:start', record)
    const deleteIndex = requests.indexOf(`DELETE /api/books/${withImage.id}`)
    expect(deleteIndex).toBeGreaterThan(-1)
    expect(requests.slice(deleteIndex + 1)).not.toContain(`GET /api/books/${withImage.id}`)
    expect(screen.queryByRole('heading', { name: 'Libro no encontrado' })).not.toBeInTheDocument()
    await waitFor(() => expect(queryClient.getQueryState(bookKeys.detail(withImage.id))).toBeUndefined())
  })

  it('no elimina si se cancela la confirmación', async () => {
    const { user } = renderDetail(withImage.id)
    await user.click(await screen.findByRole('button', { name: 'Eliminar' }))
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(db.deletedBookIds.has(withImage.id)).toBe(false)
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
