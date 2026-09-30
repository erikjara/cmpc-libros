import { describe, expect, it } from 'vitest'
import { parseSort, serializeSort } from './sort'

describe('parseSort', () => {
  it('convierte el formato del contrato en SortingState', () => {
    expect(parseSort('price:desc,title:asc')).toEqual([
      { id: 'price', desc: true },
      { id: 'title', desc: false },
    ])
  })

  it('devuelve un arreglo vacío si no hay valor', () => {
    expect(parseSort(null)).toEqual([])
    expect(parseSort('')).toEqual([])
  })

  it('descarta campos no permitidos, direcciones inválidas y repetidos', () => {
    expect(parseSort('foo:asc,price:up,title:asc,title:desc,stock')).toEqual([
      { id: 'title', desc: false },
    ])
  })
})

describe('serializeSort', () => {
  it('serializa respetando la prioridad', () => {
    expect(
      serializeSort([
        { id: 'author', desc: false },
        { id: 'price', desc: true },
      ]),
    ).toBe('author:asc,price:desc')
  })

  it('devuelve undefined si no hay orden', () => {
    expect(serializeSort([])).toBeUndefined()
  })

  it('ignora columnas que no son campos de orden', () => {
    expect(serializeSort([{ id: 'actions', desc: false }])).toBeUndefined()
  })
})
