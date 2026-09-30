import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { errorBody } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { BooksListPage } from './BooksListPage'

function renderList(initialEntry = '/books') {
  const utils = renderWithProviders(<BooksListPage />, { path: '/books', initialEntry })
  const params = () => new URLSearchParams(utils.router.state.location.search)
  return { ...utils, params }
}

describe('BooksListPage', () => {
  it('muestra un skeleton y luego la primera página de libros', async () => {
    renderList()
    expect(screen.getByTestId('books-skeleton')).toBeInTheDocument()
    expect(await screen.findAllByRole('row')).toHaveLength(11)
    expect(screen.getByText('25 libros · Página 1 de 3')).toBeInTheDocument()
  })

  it('pide al servidor el orden de la URL', async () => {
    renderList('/books?sort=price:asc')
    const rows = await screen.findAllByRole('row')
    expect(within(rows[1]).getByText('Veinte poemas de amor')).toBeInTheDocument()
  })

  it('navega entre páginas y conserva los filtros', async () => {
    const { user, params } = renderList('/books?available=true')
    await screen.findByText(/Página 1 de/)
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(params().get('page')).toBe('2')
    expect(params().get('available')).toBe('true')
    expect(await screen.findByText(/Página 2 de/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(params().get('page')).toBeNull()
  })

  it('deshabilita "Anterior" en la primera página y "Siguiente" en la última', async () => {
    renderList('/books?page=3')
    await screen.findByText('25 libros · Página 3 de 3')
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled()
  })

  it('cambia el tamaño de página y vuelve a la página 1', async () => {
    const { user, params } = renderList('/books?page=2')
    await screen.findByText(/Página 2 de 3/)
    await user.click(screen.getByLabelText('Por página'))
    await user.click(await screen.findByRole('option', { name: '20' }))
    expect(params().get('limit')).toBe('20')
    expect(params().get('page')).toBeNull()
    expect(await screen.findByText('25 libros · Página 1 de 2')).toBeInTheDocument()
  })

  it('muestra el estado vacío y permite limpiar filtros', async () => {
    const { user, params } = renderList('/books?search=zzzz')
    expect(await screen.findByText('No se encontraron libros')).toBeInTheDocument()
    const empty = screen.getByText('No se encontraron libros').parentElement as HTMLElement
    await user.click(within(empty).getByRole('button', { name: 'Limpiar filtros' }))
    expect(params().get('search')).toBeNull()
    expect(await screen.findAllByRole('row')).toHaveLength(11)
  })

  it('muestra una página fuera de rango como vacía sin error', async () => {
    renderList('/books?page=99')
    expect(await screen.findByText('No se encontraron libros')).toBeInTheDocument()
  })

  it('construye el enlace de exportación con los filtros activos', async () => {
    renderList('/books?search=cien&available=true&sort=title:asc&page=2&limit=20')
    const link = screen.getByRole('link', { name: 'Exportar CSV' })
    expect(link).toHaveAttribute('href', '/api/books/export?search=cien&available=true&sort=title%3Aasc')
  })

  it('muestra un error con "Reintentar" y recupera la lista', async () => {
    let fail = true
    server.use(
      http.get('/api/books', () => {
        if (!fail) return undefined
        return HttpResponse.json(errorBody(500, 'Internal Server Error', 'Error interno del servidor'), { status: 500 })
      }),
    )
    const { user } = renderList()
    expect(await screen.findByText('No se pudieron cargar los libros')).toBeInTheDocument()
    expect(screen.getByText('Error interno del servidor')).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(11))
  })
})
