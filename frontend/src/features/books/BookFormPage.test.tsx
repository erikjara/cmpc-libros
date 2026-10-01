import { QueryClient } from '@tanstack/react-query'
import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { db, simulateExternalUpdate } from '@/test/msw/db'
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
    expect(screen.getByLabelText('Precio (CLP)')).toHaveValue('15.990')
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

  it('deshabilita "Guardar cambios" mientras no haya cambios', async () => {
    renderPage(`/books/${existing.id}/edit`)
    expect(await screen.findByLabelText('Título')).toHaveValue('Cien años de soledad')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  })

  it('si solo cambia la portada la sube sin enviar un PATCH', async () => {
    const { user } = renderPage(`/books/${existing.id}/edit`)
    await screen.findByLabelText('Título')
    await user.upload(screen.getByLabelText('Portada'), new File([new Uint8Array(10)], 'p.webp', { type: 'image/webp' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Libro actualizado')).toBeInTheDocument()
    expect(db.bookPatches).toHaveLength(0)
    expect(db.books[0].imageUrl).toBe(`/api/uploads/${existing.id}.webp`)
  })

  it('con el detalle en caché y un cambio ajeno, editar solo el título no revierte stock ni precio', async () => {
    // Caché como la deja el detalle (staleTime de 30 s, aún vigente) con la versión anterior.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 30_000 }, mutations: { retry: false } },
    })
    queryClient.setQueryData(bookKeys.detail(existing.id), existing)
    // Otra persona cambia stock y precio por la API.
    const external = simulateExternalUpdate(existing.id, { stock: 99, price: 21990 })

    const { user } = renderRoutes(
      [
        { path: '/books/:id/edit', element: <BookFormPage /> },
        { path: '*', element: <LocationDisplay /> },
      ],
      { initialEntries: [`/books/${existing.id}/edit`], queryClient },
    )

    // No se muestra la copia en caché: el formulario espera la versión vigente del servidor.
    expect(screen.getByTestId('book-form-skeleton')).toBeInTheDocument()
    const title = await screen.findByLabelText('Título')
    expect(screen.getByLabelText('Stock')).toHaveValue('99')
    expect(screen.getByLabelText('Precio (CLP)')).toHaveValue('21.990')

    await user.clear(title)
    await user.type(title, 'Cien años de soledad (edición conmemorativa)')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Libro actualizado')).toBeInTheDocument()

    expect(db.bookPatches).toEqual([
      {
        id: existing.id,
        ifMatch: `"${external.updatedAt}"`,
        body: { title: 'Cien años de soledad (edición conmemorativa)' },
      },
    ])
    expect(db.books[0]).toMatchObject({
      title: 'Cien años de soledad (edición conmemorativa)',
      stock: 99,
      price: 21990,
    })
  })

  it('sin cambios locales adopta la versión nueva del servidor y la usa como If-Match', async () => {
    const { user, queryClient } = renderPage(`/books/${existing.id}/edit`)
    await screen.findByLabelText('Título')
    const external = simulateExternalUpdate(existing.id, { stock: 42 })
    await queryClient.invalidateQueries({ queryKey: bookKeys.detail(existing.id) })
    await waitFor(() => expect(screen.getByLabelText('Stock')).toHaveValue('42'))

    const price = screen.getByLabelText('Precio (CLP)')
    await user.clear(price)
    await user.type(price, '9990')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Libro actualizado')).toBeInTheDocument()
    expect(db.bookPatches).toEqual([{ id: existing.id, ifMatch: `"${external.updatedAt}"`, body: { price: 9990 } }])
    expect(db.books[0]).toMatchObject({ stock: 42, price: 9990 })
  })

  it('con cambios locales no pisa lo escrito y, tras el 412, exige recargar la versión actual', async () => {
    const { user, queryClient } = renderPage(`/books/${existing.id}/edit`)
    const stock = await screen.findByLabelText('Stock')
    await user.clear(stock)
    await user.type(stock, '1')

    // Otra persona cambia stock y precio; el detalle se vuelve a leer con el formulario abierto.
    const external = simulateExternalUpdate(existing.id, { stock: 99, price: 21990 })
    await queryClient.invalidateQueries({ queryKey: bookKeys.detail(existing.id) })
    await waitFor(() =>
      expect(queryClient.getQueryData<Book>(bookKeys.detail(existing.id))?.updatedAt).toBe(external.updatedAt),
    )
    expect(screen.getByLabelText('Stock')).toHaveValue('1')
    expect(screen.getByLabelText('Precio (CLP)')).toHaveValue('15.990')

    // El If-Match es la versión que se mostró: el servidor rechaza el guardado.
    const save = screen.getByRole('button', { name: 'Guardar cambios' })
    await user.click(save)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(STALE_BOOK_MESSAGE)
    expect(db.bookPatches).toEqual([{ id: existing.id, ifMatch: `"${existing.updatedAt}"`, body: { stock: 1 } }])
    expect(db.books[0]).toMatchObject({ stock: 99, price: 21990 })
    expect(screen.queryByTestId('location')).not.toBeInTheDocument()

    // No se puede volver a guardar encima sin decidir: el envío queda bloqueado.
    expect(screen.getByLabelText('Stock')).toHaveValue('1')
    expect(save).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Recargar versión actual' }))
    await waitFor(() => expect(screen.getByLabelText('Stock')).toHaveValue('99'))
    expect(screen.getByLabelText('Precio (CLP)')).toHaveValue('21.990')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    const reloadedStock = screen.getByLabelText('Stock')
    await user.clear(reloadedStock)
    await user.type(reloadedStock, '98')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Libro actualizado')).toBeInTheDocument()
    expect(db.bookPatches[1]).toEqual({ id: existing.id, ifMatch: `"${external.updatedAt}"`, body: { stock: 98 } })
    expect(db.books[0]).toMatchObject({ stock: 98, price: 21990 })
  })

  it('si falla la recarga tras un 412 lo informa y mantiene el aviso', async () => {
    const { user } = renderPage(`/books/${existing.id}/edit`)
    const stock = await screen.findByLabelText('Stock')
    simulateExternalUpdate(existing.id, { stock: 99 })
    await user.clear(stock)
    await user.type(stock, '1')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(STALE_BOOK_MESSAGE)

    server.use(
      http.get('/api/books/:id', () =>
        HttpResponse.json(errorBody(500, 'Internal Server Error', 'Error interno del servidor'), { status: 500 }),
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Recargar versión actual' }))
    expect(await screen.findByText('Error interno del servidor')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(STALE_BOOK_MESSAGE)
    expect(screen.getByLabelText('Stock')).toHaveValue('1')
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
