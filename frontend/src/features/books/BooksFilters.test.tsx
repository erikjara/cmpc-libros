import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/test/msw/db'
import { authors, genres, publishers } from '@/test/msw/fixtures'
import { renderWithProviders } from '@/test/render'
import { BooksFilters } from './BooksFilters'
import { useBookSearchParams } from './useBookSearchParams'

function Harness() {
  const { state, setFilters, clearFilters, hasActiveFilters } = useBookSearchParams()
  return (
    <BooksFilters values={state} onChange={setFilters} onClear={clearFilters} hasActiveFilters={hasActiveFilters} />
  )
}

function renderFilters(initialEntry = '/books?page=3') {
  const utils = renderWithProviders(<Harness />, { path: '/books', initialEntry })
  const params = () => new URLSearchParams(utils.router.state.location.search)
  return { ...utils, params }
}

describe('BooksFilters', () => {
  afterEach(() => vi.useRealTimers())

  it('aplica la búsqueda tras 400 ms sin escribir y vuelve a la página 1', async () => {
    const { params } = renderFilters()
    vi.useFakeTimers()
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'cien' } })
    act(() => vi.advanceTimersByTime(399))
    expect(params().get('search')).toBeNull()
    act(() => vi.advanceTimersByTime(1))
    expect(params().get('search')).toBe('cien')
    expect(params().get('page')).toBeNull()
  })

  it('filtra por género buscando en el servidor', async () => {
    const { user, params } = renderFilters()
    await user.type(screen.getByLabelText('Género'), 'poe')
    await user.click(await screen.findByRole('option', { name: genres[1].name }))
    expect(params().get('genreId')).toBe(genres[1].id)
    expect(params().get('page')).toBeNull()
    expect(screen.getByLabelText('Género')).toHaveValue(genres[1].name)
    await user.click(screen.getByRole('button', { name: 'Quitar género' }))
    expect(params().get('genreId')).toBeNull()
  })

  it('permite filtrar por un género posterior a los 50 primeros', async () => {
    const extra = Array.from({ length: 60 }, (_, i) => ({
      id: `30000000-0000-4000-8000-${String(100 + i).padStart(12, '0')}`,
      name: `Género ${String(i + 1).padStart(2, '0')}`,
    }))
    db.genres.push(...extra)
    const target = extra[59]
    const { user, params } = renderFilters()

    // Sin búsqueda la API entrega como máximo 50: el género 60 no está entre las opciones.
    await user.click(screen.getByRole('button', { name: 'Mostrar géneros' }))
    expect(await screen.findAllByRole('option')).toHaveLength(50)
    expect(screen.queryByRole('option', { name: target.name })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Género'), target.name)
    await user.click(await screen.findByRole('option', { name: target.name }))
    expect(params().get('genreId')).toBe(target.id)
    expect(screen.getByLabelText('Género')).toHaveValue(target.name)
  })

  it('muestra el nombre del género filtrado al cargar desde la URL', async () => {
    renderFilters(`/books?genreId=${genres[1].id}`)
    expect(await screen.findByDisplayValue(genres[1].name)).toBeInTheDocument()
  })

  it('filtra por disponibilidad', async () => {
    const { user, params } = renderFilters()
    await user.click(screen.getByLabelText('Disponibilidad'))
    await user.click(await screen.findByRole('option', { name: 'Agotados' }))
    expect(params().get('available')).toBe('false')
    await user.click(screen.getByLabelText('Disponibilidad'))
    await user.click(await screen.findByRole('option', { name: 'Todos' }))
    expect(params().get('available')).toBeNull()
  })

  it('filtra por autor buscando en el servidor', async () => {
    const { user, params } = renderFilters()
    await user.type(screen.getByLabelText('Autor'), 'neru')
    await user.click(await screen.findByRole('option', { name: authors[2].name }))
    expect(params().get('authorId')).toBe(authors[2].id)
    expect(screen.getByLabelText('Autor')).toHaveValue(authors[2].name)
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(params().get('authorId')).toBeNull()
    expect(screen.getByLabelText('Autor')).toHaveValue('')
  })

  it('los botones que despliegan autores, editoriales y géneros tienen nombre accesible', async () => {
    const { user, params } = renderFilters()
    expect(screen.getByRole('button', { name: 'Mostrar editoriales' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mostrar géneros' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mostrar autores' }))
    await user.click(await screen.findByRole('option', { name: authors[1].name }))
    expect(params().get('authorId')).toBe(authors[1].id)
    await user.click(screen.getByRole('button', { name: 'Quitar autor' }))
    expect(params().get('authorId')).toBeNull()
  })

  it('muestra el nombre de la editorial filtrada al cargar desde la URL', async () => {
    renderFilters(`/books?publisherId=${publishers[1].id}`)
    expect(await screen.findByDisplayValue(publishers[1].name)).toBeInTheDocument()
  })

  it('limpia filtros y búsqueda conservando el orden', async () => {
    const { user, params } = renderFilters(`/books?search=cien&genreId=${genres[0].id}&sort=title:asc`)
    expect(screen.getByLabelText('Buscar')).toHaveValue('cien')
    expect(await screen.findByDisplayValue(genres[0].name)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(params().toString()).toBe('sort=title%3Aasc')
    expect(screen.getByLabelText('Buscar')).toHaveValue('')
    expect(screen.getByLabelText('Género')).toHaveValue('')
  })
})
