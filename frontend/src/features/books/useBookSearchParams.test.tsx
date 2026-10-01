import { act, renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigationType } from 'react-router'
import { describe, expect, it } from 'vitest'
import { parseBookSearchParams, useBookSearchParams } from './useBookSearchParams'

function setup(initialEntry = '/books') {
  const { result } = renderHook(
    () => ({ params: useBookSearchParams(), location: useLocation(), navigationType: useNavigationType() }),
    {
      wrapper: ({ children }) => <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>,
    },
  )
  return {
    get result() {
      return result.current.params
    },
    get search() {
      return result.current.location.search
    },
    get navigationType() {
      return result.current.navigationType
    },
  }
}

describe('parseBookSearchParams', () => {
  it('aplica valores por defecto', () => {
    expect(parseBookSearchParams(new URLSearchParams())).toEqual({
      page: 1,
      limit: 10,
      search: '',
      authorId: undefined,
      publisherId: undefined,
      genreId: undefined,
      available: undefined,
      sorting: [],
    })
  })

  it('normaliza valores inválidos', () => {
    const state = parseBookSearchParams(
      new URLSearchParams('page=-3&limit=500&available=quizas&sort=foo:asc'),
    )
    expect(state).toMatchObject({ page: 1, limit: 10, available: undefined, sorting: [] })
  })

  it('descarta páginas mayores al máximo que acepta la API', () => {
    expect(parseBookSearchParams(new URLSearchParams('page=1000000')).page).toBe(1_000_000)
    expect(parseBookSearchParams(new URLSearchParams('page=1000001')).page).toBe(1)
  })

  it('lee todos los parámetros', () => {
    const state = parseBookSearchParams(
      new URLSearchParams('page=3&limit=20&search=neruda&genreId=g1&authorId=a1&publisherId=p1&available=false&sort=price:desc'),
    )
    expect(state).toEqual({
      page: 3,
      limit: 20,
      search: 'neruda',
      genreId: 'g1',
      authorId: 'a1',
      publisherId: 'p1',
      available: 'false',
      sorting: [{ id: 'price', desc: true }],
    })
  })
})

describe('useBookSearchParams', () => {
  it('construye el query del contrato sin valores vacíos', () => {
    const hook = setup('/books?page=2&search=%20cien%20&sort=title:asc')
    expect(hook.result.query).toEqual({ page: 2, limit: 10, search: 'cien', sort: 'title:asc' })
    expect(hook.result.filters).toEqual({ search: 'cien', sort: 'title:asc' })
  })

  it('cambiar un filtro vuelve a la página 1', () => {
    const hook = setup('/books?page=4')
    act(() => hook.result.setFilters({ genreId: 'g1' }))
    expect(hook.search).toBe('?genreId=g1')
    expect(hook.result.state.page).toBe(1)
  })

  it('cambiar la búsqueda vuelve a la página 1 y un valor vacío elimina el parámetro', () => {
    const hook = setup('/books?page=4&search=abc')
    act(() => hook.result.setFilters({ search: '' }))
    expect(hook.search).toBe('')
  })

  it('setPage conserva los filtros', () => {
    const hook = setup('/books?available=true')
    act(() => hook.result.setPage(3))
    expect(hook.search).toBe('?available=true&page=3')
    act(() => hook.result.setPage(1))
    expect(hook.search).toBe('?available=true')
  })

  it('setLimit reinicia la página y omite el valor por defecto', () => {
    const hook = setup('/books?page=2')
    act(() => hook.result.setLimit(20))
    expect(hook.search).toBe('?limit=20')
    act(() => hook.result.setLimit(10))
    expect(hook.search).toBe('')
  })

  it('setSorting serializa el orden y reinicia la página', () => {
    const hook = setup('/books?page=2')
    act(() => hook.result.setSorting([{ id: 'price', desc: true }, { id: 'title', desc: false }]))
    expect(new URLSearchParams(hook.search).get('sort')).toBe('price:desc,title:asc')
    expect(hook.result.state.page).toBe(1)
    act(() => hook.result.setSorting([]))
    expect(hook.search).toBe('')
  })

  it('clearFilters elimina filtros y búsqueda pero conserva orden y tamaño de página', () => {
    const hook = setup('/books?search=a&genreId=g&available=true&sort=title:asc&limit=20&page=3')
    expect(hook.result.hasActiveFilters).toBe(true)
    act(() => hook.result.clearFilters())
    expect(hook.search).toBe('?sort=title%3Aasc&limit=20')
    expect(hook.result.hasActiveFilters).toBe(false)
  })

  it('la búsqueda y los filtros reemplazan la entrada del historial', () => {
    const hook = setup('/books')
    act(() => hook.result.setFilters({ search: 'cien' }))
    expect(hook.navigationType).toBe('REPLACE')
    act(() => hook.result.setPage(2))
    expect(hook.navigationType).toBe('PUSH')
    act(() => hook.result.setFilters({ available: 'true' }))
    expect(hook.navigationType).toBe('REPLACE')
    act(() => hook.result.setSorting([{ id: 'title', desc: false }]))
    expect(hook.navigationType).toBe('PUSH')
    act(() => hook.result.clearFilters())
    expect(hook.navigationType).toBe('REPLACE')
  })
})
