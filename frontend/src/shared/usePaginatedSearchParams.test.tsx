import { act, renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigationType } from 'react-router'
import { describe, expect, it } from 'vitest'
import { usePaginatedSearchParams } from './usePaginatedSearchParams'

function setup(initialEntry = '/trash') {
  const { result } = renderHook(
    () => ({ params: usePaginatedSearchParams(), location: useLocation(), navigationType: useNavigationType() }),
    { wrapper: ({ children }) => <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter> },
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

describe('usePaginatedSearchParams', () => {
  it('lee página y tamaño de la URL con valores por defecto y normaliza los inválidos', () => {
    expect(setup().result).toMatchObject({ page: 1, limit: 10 })
    expect(setup('/trash?page=3&limit=20').result).toMatchObject({ page: 3, limit: 20 })
    expect(setup('/trash?page=-1&limit=500').result).toMatchObject({ page: 1, limit: 10 })
    expect(setup('/trash?page=1000001').result.page).toBe(1)
  })

  it('setPage agrega una entrada al historial y conserva los demás parámetros', () => {
    const hook = setup('/trash?search=neruda')
    act(() => hook.result.setPage(2))
    expect(hook.search).toBe('?search=neruda&page=2')
    expect(hook.navigationType).toBe('PUSH')
    act(() => hook.result.setPage(1))
    expect(hook.search).toBe('?search=neruda')
  })

  it('setLimit reinicia la página y omite el valor por defecto', () => {
    const hook = setup('/trash?page=3')
    act(() => hook.result.setLimit(20))
    expect(hook.search).toBe('?limit=20')
    act(() => hook.result.setLimit(10))
    expect(hook.search).toBe('')
  })

  it('setParam reinicia la página, reemplaza la entrada y elimina valores vacíos', () => {
    const hook = setup('/audit?page=2')
    act(() => hook.result.setParam('entity', 'Book'))
    expect(hook.search).toBe('?entity=Book')
    expect(hook.navigationType).toBe('REPLACE')
    expect(hook.result.searchParams.get('entity')).toBe('Book')
    act(() => hook.result.setParam('entity', undefined))
    expect(hook.search).toBe('')
  })
})
