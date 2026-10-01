import { describe, expect, it } from 'vitest'
import { buildBooks } from '@/test/msw/fixtures'
import { bookFormSchema, bookToFormValues, emptyBookForm, formatPriceInput, parsePrice, PRICE_FORMAT_MESSAGE } from './book-form.schema'

describe('formatPriceInput (formato es-CL)', () => {
  it.each([
    [12990, '12.990'],
    [12990.5, '12.990,5'],
    [8990, '8.990'],
    [0, '0'],
    [0.5, '0,5'],
    [1234567.89, '1.234.567,89'],
    [99_999_999.99, '99.999.999,99'],
  ])('%s → %s y parsePrice lo lee de vuelta', (price, expected) => {
    expect(formatPriceInput(price)).toBe(expected)
    expect(parsePrice(formatPriceInput(price))).toBe(price)
  })

  it('bookToFormValues muestra el precio con formato', () => {
    const [book] = buildBooks()
    expect(bookToFormValues({ ...book, price: 12990 }).price).toBe('12.990')
    expect(bookToFormValues({ ...book, price: 12990.5 }).price).toBe('12.990,5')
  })
})

describe('parsePrice (formato es-CL)', () => {
  it.each([
    ['15990', 15990],
    ['15.990', 15990],
    ['15.990,5', 15990.5],
    ['15990,50', 15990.5],
    ['15990.50', 15990.5],
    ['15990.5', 15990.5],
    ['1.000.000', 1_000_000],
    ['1.000.000,99', 1_000_000.99],
    ['99.999.999,99', 99_999_999.99],
    ['0', 0],
    ['0,5', 0.5],
    ['1.234', 1234],
    ['12.99', 12.99],
    [' 15.990 ', 15990],
  ])('interpreta %j como %d', (input, expected) => {
    expect(parsePrice(input)).toBe(expected)
  })

  it.each(['15.99.0', '-5', '1e3', 'abc', '15,999', '15.990.5', '1,234,567', '15 990', '15.', ',5', '', '1.5,5'])(
    'rechaza %j',
    (input) => {
      expect(parsePrice(input)).toBeNull()
    },
  )
})

describe('bookFormSchema: precio', () => {
  const parse = (price: string) => bookFormSchema.safeParse({ ...emptyBookForm, title: 'T', authorName: 'A', publisherName: 'P', genreName: 'G', stock: '1', price })

  it('envía el precio como number', () => {
    const result = parse('15.990,5')
    expect(result.success && result.data.price).toBe(15990.5)
  })

  it('explica el formato esperado cuando el precio no es válido', () => {
    const result = parse('15,999')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe(PRICE_FORMAT_MESSAGE)
    expect(PRICE_FORMAT_MESSAGE).toMatch(/15\.990/)
  })

  it('rechaza precios sobre el máximo', () => {
    const result = parse('100.000.000')
    expect(result.error?.issues[0].message).toBe('El precio máximo es 99.999.999,99')
  })

  it('exige el precio', () => {
    expect(parse('  ').error?.issues[0].message).toBe('Ingresa el precio')
  })
})
