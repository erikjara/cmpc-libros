import { describe, expect, it } from 'vitest'
import { formatCLP, formatDateTime } from './formatters'

describe('formatCLP', () => {
  it('usa separador de miles con punto y sin decimales para montos enteros', () => {
    expect(formatCLP(15990)).toBe('$15.990')
    expect(formatCLP(0)).toBe('$0')
  })

  it('muestra hasta 2 decimales con coma cuando existen', () => {
    expect(formatCLP(15990.5)).toBe('$15.990,5')
    expect(formatCLP(99_999_999.99)).toBe('$99.999.999,99')
  })
})

describe('formatDateTime', () => {
  it('formatea una fecha ISO en español de Chile', () => {
    expect(formatDateTime('2026-06-15T15:00:00Z')).toMatch(/2026/)
  })
})
