import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

  it('filtra por género con el select', async () => {
    const { user, params } = renderFilters()
    await user.click(screen.getByLabelText('Género'))
    await user.click(await screen.findByRole('option', { name: genres[1].name }))
    expect(params().get('genreId')).toBe(genres[1].id)
    expect(params().get('page')).toBeNull()
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

  it('muestra el nombre de la editorial filtrada al cargar desde la URL', async () => {
    renderFilters(`/books?publisherId=${publishers[1].id}`)
    expect(await screen.findByDisplayValue(publishers[1].name)).toBeInTheDocument()
  })

  it('limpia filtros y búsqueda conservando el orden', async () => {
    const { user, params } = renderFilters(`/books?search=cien&genreId=${genres[0].id}&sort=title:asc`)
    expect(screen.getByLabelText('Buscar')).toHaveValue('cien')
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(params().toString()).toBe('sort=title%3Aasc')
    expect(screen.getByLabelText('Buscar')).toHaveValue('')
  })
})
