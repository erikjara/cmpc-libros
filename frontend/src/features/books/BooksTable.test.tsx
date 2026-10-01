import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { buildBooks } from '@/test/msw/fixtures'
import { renderWithProviders } from '@/test/render'
import { BooksTable } from './BooksTable'
import { useBookSearchParams } from './useBookSearchParams'

const books = buildBooks().slice(0, 3)

function Harness() {
  const { state, setSorting } = useBookSearchParams()
  return (
    <BooksTable
      books={books}
      total={books.length}
      page={state.page}
      limit={state.limit}
      sorting={state.sorting}
      onSortingChange={setSorting}
    />
  )
}

function renderTable(initialEntry = '/books') {
  const utils = renderWithProviders(<Harness />, { path: '/books', initialEntry })
  const sortParam = () => new URLSearchParams(utils.router.state.location.search).get('sort')
  const header = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) })
  return { ...utils, sortParam, header }
}

describe('BooksTable', () => {
  it('muestra una fila por libro con precio en CLP y disponibilidad', () => {
    renderTable()
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(4)
    const first = within(rows[1])
    expect(first.getByRole('link', { name: 'Cien años de soledad' })).toHaveAttribute(
      'href',
      `/books/${books[0].id}`,
    )
    expect(first.getByText('$15.990')).toBeInTheDocument()
    expect(first.getByText('Disponible (5)')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Agotado')).toBeInTheDocument()
  })

  it('cicla asc → desc → sin orden al hacer clic en un encabezado', async () => {
    const { user, sortParam, header } = renderTable()
    await user.click(header('Precio'))
    expect(sortParam()).toBe('price:asc')
    await user.click(header('Precio'))
    expect(sortParam()).toBe('price:desc')
    await user.click(header('Precio'))
    expect(sortParam()).toBeNull()
  })

  it('un clic simple ordena solo por esa columna y reemplaza el orden existente', async () => {
    const { user, sortParam, header } = renderTable('/books?sort=author:asc,price:desc')
    await user.click(header('Título'))
    expect(sortParam()).toBe('title:asc')
  })

  it('un clic simple sobre una columna del orden múltiple la deja como única', async () => {
    const { user, sortParam, header } = renderTable('/books?sort=author:asc,price:asc')
    await user.click(header('Precio'))
    expect(sortParam()).toBe('price:desc')
  })

  it('Mayús + clic agrega columnas al orden existente y muestra la prioridad', async () => {
    const { user, sortParam, header } = renderTable()
    await user.click(header('Autor'))
    await user.keyboard('{Shift>}')
    await user.click(header('Precio'))
    await user.click(header('Precio'))
    await user.keyboard('{/Shift}')
    expect(sortParam()).toBe('author:asc,price:desc')
    expect(screen.getByLabelText('Prioridad 1, ascendente')).toBeInTheDocument()
    expect(screen.getByLabelText('Prioridad 2, descendente')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Precio/ })).toHaveAttribute('aria-sort', 'descending')
  })

  it('Mayús + clic sobre una columna en desc la quita y conserva el resto del orden', async () => {
    const { user, sortParam, header } = renderTable('/books?sort=author:asc,price:desc')
    await user.keyboard('{Shift>}')
    await user.click(header('Precio'))
    await user.keyboard('{/Shift}')
    expect(sortParam()).toBe('author:asc')
  })

  it('indica cómo ordenar por varias columnas', () => {
    const { header } = renderTable()
    expect(screen.getByText('Mayús + clic para ordenar por varias columnas')).toBeInTheDocument()
    const button = header('Precio')
    expect(button).toHaveAttribute('title', 'Mayús + clic para ordenar por varias columnas')
    expect(button).toHaveAccessibleDescription('Mayús + clic para ordenar por varias columnas')
  })

  it('ordenar vuelve a la página 1', async () => {
    const { user, router, header } = renderTable('/books?page=3')
    await user.click(header('Título'))
    expect(router.state.location.search).toBe('?sort=title%3Aasc')
  })
})
