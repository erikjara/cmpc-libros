import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { bookKeys } from '@/features/books/books.queries'
import { formatDateTime } from '@/lib/formatters'
import { db } from '@/test/msw/db'
import { buildBooks } from '@/test/msw/fixtures'
import { errorBody } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { TrashPage } from './TrashPage'

const books = buildBooks()
const [cien, casa] = books

function trash(index: number, deletedAt: string) {
  db.deletedBookIds.set(books[index].id, deletedAt)
}

function trashAll() {
  books.forEach((book, index) => db.deletedBookIds.set(book.id, new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString()))
}

function renderTrash(initialEntry = '/trash') {
  return renderWithProviders(<TrashPage />, { path: '/trash', initialEntry })
}

describe('TrashPage', () => {
  it('muestra un skeleton y luego los libros eliminados con su fecha de eliminación', async () => {
    trash(0, '2026-09-01T10:00:00.000Z')
    trash(1, '2026-09-02T15:30:00.000Z')
    renderTrash()
    expect(screen.getByRole('heading', { name: 'Papelera' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
    const rows = await screen.findAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Título',
      'Autor',
      'Editorial',
      'Eliminado el',
      'Acciones',
    ])
    expect(rows[1]).toHaveTextContent('La casa de los espíritus')
    expect(rows[1]).toHaveTextContent('Isabel Allende')
    expect(rows[1]).toHaveTextContent('Plaza & Janés')
    expect(rows[1]).toHaveTextContent(formatDateTime('2026-09-02T15:30:00.000Z'))
    expect(rows[2]).toHaveTextContent('Cien años de soledad')
  })

  it('muestra "La papelera está vacía" si no hay libros eliminados', async () => {
    renderTrash()
    expect(await screen.findByText('La papelera está vacía')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument()
  })

  it('busca con debounce, guarda la búsqueda en la URL y vuelve a la página 1', async () => {
    trashAll()
    const { user, router } = renderTrash('/trash?page=2')
    await screen.findByText(/Página 2 de 3/)
    await user.type(screen.getByLabelText('Buscar'), 'allende')
    await waitFor(() => expect(router.state.location.search).toBe('?search=allende'))
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(9))
    expect(screen.getByText('La casa de los espíritus')).toBeInTheDocument()
  })

  it('informa cuando la búsqueda no encuentra libros eliminados', async () => {
    trash(0, '2026-09-01T10:00:00.000Z')
    renderTrash('/trash?search=borges')
    expect(await screen.findByText('No se encontraron libros eliminados')).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar')).toHaveValue('borges')
  })

  it('pagina en el servidor con el estado en la URL', async () => {
    trashAll()
    const { user, router } = renderTrash()
    expect(await screen.findByText('25 libros eliminados · Página 1 de 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Siguiente/ }))
    expect(router.state.location.search).toBe('?page=2')
    expect(await screen.findByText('25 libros eliminados · Página 2 de 3')).toBeInTheDocument()
  })

  it('restaura un libro: toast, sale de la papelera e invalida el listado de libros', async () => {
    trash(0, '2026-09-01T10:00:00.000Z')
    trash(1, '2026-09-02T10:00:00.000Z')
    const { user, queryClient } = renderTrash()
    queryClient.setQueryData(bookKeys.list({ page: 1, limit: 10 }), { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } })
    await user.click(await screen.findByRole('button', { name: `Restaurar ${cien.title}` }))
    expect(await screen.findByText('Libro restaurado')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText(cien.title)).not.toBeInTheDocument())
    expect(screen.getByText(casa.title)).toBeInTheDocument()
    expect(db.deletedBookIds.has(cien.id)).toBe(false)
    expect(queryClient.getQueryState(bookKeys.list({ page: 1, limit: 10 }))?.isInvalidated).toBe(true)
  })

  it('al restaurar el último libro de la última página vuelve a la página anterior', async () => {
    trashAll()
    const { user, router } = renderTrash('/trash?page=3')
    const rows = await screen.findAllByRole('row')
    expect(rows).toHaveLength(6)
    for (const row of rows.slice(1)) {
      await user.click(within(row).getByRole('button', { name: /^Restaurar/ }))
      await waitFor(() => expect(row).not.toBeInTheDocument())
    }
    expect(await screen.findByText('20 libros eliminados · Página 2 de 2')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?page=2')
  })

  it('muestra un toast de error si la restauración falla', async () => {
    trash(0, '2026-09-01T10:00:00.000Z')
    server.use(
      http.post('/api/books/:id/restore', () =>
        HttpResponse.json(errorBody(404, 'Not Found', 'Recurso no encontrado'), { status: 404 }),
      ),
    )
    const { user } = renderTrash()
    await user.click(await screen.findByRole('button', { name: `Restaurar ${cien.title}` }))
    expect(await screen.findByText('Recurso no encontrado')).toBeInTheDocument()
    expect(screen.getByText(cien.title)).toBeInTheDocument()
  })

  it('muestra un error con "Reintentar" y recupera la papelera', async () => {
    trash(0, '2026-09-01T10:00:00.000Z')
    let fail = true
    server.use(
      http.get('/api/books/trash', () => {
        if (!fail) return undefined
        return HttpResponse.json(errorBody(500, 'Internal Server Error', 'Error interno del servidor'), { status: 500 })
      }),
    )
    const { user } = renderTrash()
    expect(await screen.findByText('No se pudo cargar la papelera')).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText(cien.title)).toBeInTheDocument()
  })
})
