import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { db } from '@/test/msw/db'
import { buildBooks } from '@/test/msw/fixtures'
import { errorBody, STALE_BOOK_MESSAGE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { LocationDisplay } from '@/test/LocationDisplay'
import { renderRoutes } from '@/test/render'
import type { Book } from '@/lib/api-types'
import { bookKeys } from './books.queries'
import { BookFormPage } from './BookFormPage'

const [existing] = buildBooks()

function renderPage(initialEntry: string) {
  return renderRoutes(
    [
      { path: '/books/new', element: <BookFormPage /> },
      { path: '/books/:id/edit', element: <BookFormPage /> },
      { path: '*', element: <LocationDisplay /> },
    ],
    { initialEntries: [initialEntry] },
  )
}

async function fillNewBook(user: ReturnType<typeof renderPage>['user']) {
  await user.type(screen.getByLabelText('Título'), 'Los detectives salvajes')
  await user.type(screen.getByLabelText('Autor'), 'Roberto Bolaño')
  await user.click(await screen.findByRole('option', { name: 'Crear «Roberto Bolaño»' }))
  await user.type(screen.getByLabelText('Editorial'), 'Anagrama')
  await user.click(await screen.findByRole('option', { name: 'Crear «Anagrama»' }))
  await user.type(screen.getByLabelText('Género'), 'Novela')
  await user.click(await screen.findByRole('option', { name: 'Novela' }))
  await user.type(screen.getByLabelText('Precio (CLP)'), '18990')
  await user.type(screen.getByLabelText('Stock'), '4')
}

describe('BookFormPage (alta)', () => {
  it('crea el libro, muestra un toast y navega al detalle', async () => {
    const { user } = renderPage('/books/new')
    await fillNewBook(user)
    await user.click(screen.getByRole('button', { name: 'Crear libro' }))
    expect(await screen.findByText('Libro creado')).toBeInTheDocument()
    const created = db.books.find((book) => book.title === 'Los detectives salvajes')
    expect(created).toMatchObject({ price: 18990, stock: 4, author: { name: 'Roberto Bolaño' } })
    expect(await screen.findByTestId('location')).toHaveTextContent(`/books/${created?.id}`)
  })

  it('sube la imagen tras crear el libro', async () => {
    const { user } = renderPage('/books/new')
    await fillNewBook(user)
    await user.upload(screen.getByLabelText('Portada'), new File([new Uint8Array(10)], 'p.webp', { type: 'image/webp' }))
    await user.click(screen.getByRole('button', { name: 'Crear libro' }))
    expect(await screen.findByText('Libro creado')).toBeInTheDocument()
    const created = db.books.find((book) => book.title === 'Los detectives salvajes')
    expect(created?.imageUrl).toBe(`/api/uploads/${created?.id}.webp`)
  })

  it('informa que el libro se guardó aunque falle la imagen', async () => {
    server.use(
      http.post('/api/books/:id/image', () =>
        HttpResponse.json(errorBody(413, 'Payload Too Large', 'La imagen supera 2 MB'), { status: 413 }),
      ),
    )
    const { user } = renderPage('/books/new')
    await fillNewBook(user)
    await user.upload(screen.getByLabelText('Portada'), new File([new Uint8Array(10)], 'p.png', { type: 'image/png' }))
    await user.click(screen.getByRole('button', { name: 'Crear libro' }))
    expect(
      await screen.findByText('El libro se guardó, pero no se pudo subir la imagen: La imagen supera 2 MB'),
    ).toBeInTheDocument()
    const created = db.books.find((book) => book.title === 'Los detectives salvajes')
    expect(await screen.findByTestId('location')).toHaveTextContent(`/books/${created?.id}`)
  })

  it('muestra un toast de error y se queda en el formulario si el alta falla', async () => {
    server.use(
      http.post('/api/books', () =>
        HttpResponse.json(errorBody(400, 'Bad Request', ['title no debe estar vacío']), { status: 400 }),
      ),
    )
    const { user, router } = renderPage('/books/new')
    await fillNewBook(user)
    await user.click(screen.getByRole('button', { name: 'Crear libro' }))
    expect(await screen.findByText('title no debe estar vacío')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/books/new')
  })

  it('cancelar vuelve al listado', async () => {
    const { user } = renderPage('/books/new')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/books')
  })
})

describe('BookFormPage (edición)', () => {
  it('precarga los datos del libro', async () => {
    renderPage(`/books/${existing.id}/edit`)
    expect(await screen.findByLabelText('Título')).toHaveValue('Cien años de soledad')
    expect(screen.getByLabelText('Autor')).toHaveValue('Gabriel García Márquez')
    expect(screen.getByLabelText('Precio (CLP)')).toHaveValue('15990')
    expect(screen.getByLabelText('Stock')).toHaveValue('5')
    expect(screen.getByRole('img', { name: 'Vista previa de la portada' })).toHaveAttribute('src', '/api/uploads/cien-anos.webp')
  })

  it('guarda los cambios y navega al detalle', async () => {
    const { user } = renderPage(`/books/${existing.id}/edit`)
    const stock = await screen.findByLabelText('Stock')
    await user.clear(stock)
    await user.type(stock, '0')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Libro actualizado')).toBeInTheDocument()
    expect(db.books.find((book) => book.id === existing.id)).toMatchObject({ stock: 0, available: false })
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(`/books/${existing.id}`))
  })

  it('si otra persona modificó el libro avisa, recarga el detalle y conserva lo escrito', async () => {
    const { user, queryClient } = renderPage(`/books/${existing.id}/edit`)
    const title = await screen.findByLabelText('Título')
    // Otra persona guarda cambios después de que se cargó el formulario.
    const concurrentUpdatedAt = '2026-09-30T23:58:12.345Z'
    db.books[0] = { ...db.books[0], stock: 99, updatedAt: concurrentUpdatedAt }

    await user.clear(title)
    await user.type(title, 'Cien años de soledad (edición conmemorativa)')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText(STALE_BOOK_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByTestId('location')).not.toBeInTheDocument()
    expect(db.books[0]).toMatchObject({ title: 'Cien años de soledad', stock: 99 })
    await waitFor(() =>
      expect(queryClient.getQueryData<Book>(bookKeys.detail(existing.id))?.updatedAt).toBe(concurrentUpdatedAt),
    )
    expect(screen.getByLabelText('Título')).toHaveValue('Cien años de soledad (edición conmemorativa)')

    // Tras el aviso, guardar de nuevo se compara con la versión recién cargada.
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Libro actualizado')).toBeInTheDocument()
    expect(db.books[0].title).toBe('Cien años de soledad (edición conmemorativa)')
  })

  it('muestra "Libro no encontrado" si el libro no existe', async () => {
    renderPage('/books/40000000-0000-4000-8000-999999999999/edit')
    expect(await screen.findByRole('heading', { name: 'Libro no encontrado' })).toBeInTheDocument()
  })

  it('muestra un error con "Reintentar" si falla la carga', async () => {
    server.use(
      http.get('/api/books/:id', () =>
        HttpResponse.json(errorBody(500, 'Internal Server Error', 'Error interno del servidor'), { status: 500 }),
      ),
    )
    renderPage(`/books/${existing.id}/edit`)
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
