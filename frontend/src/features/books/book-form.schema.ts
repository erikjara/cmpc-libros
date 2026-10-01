import * as z from 'zod'
import type { Book } from '@/lib/api-types'

// Precio en formato es-CL: si el texto calza con miles agrupados (15.990, 1.000.000,5) el punto es
// separador de miles y la coma decimal; si no, un punto o una coma seguidos de 1–2 dígitos finales
// son decimales (15990,50 o 15990.50).
const THOUSANDS_PRICE = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/
const PLAIN_PRICE = /^\d+([.,]\d{1,2})?$/

export const PRICE_FORMAT_MESSAGE = 'Formato no válido: usa 15.990, 15990 o 15990,50 (hasta 2 decimales)'

export function parsePrice(raw: string): number | null {
  const value = raw.trim()
  if (THOUSANDS_PRICE.test(value)) return Number(value.replaceAll('.', '').replace(',', '.'))
  if (PLAIN_PRICE.test(value)) return Number(value.replace(',', '.'))
  return null
}

const catalogName = (message: string) =>
  z.string().trim().min(1, message).max(120, 'Máximo 120 caracteres')

export const bookFormSchema = z.object({
  title: z.string().trim().min(1, 'Ingresa el título').max(200, 'Máximo 200 caracteres'),
  authorName: catalogName('Selecciona o crea un autor'),
  publisherName: catalogName('Selecciona o crea una editorial'),
  genreName: catalogName('Selecciona o crea un género'),
  price: z
    .string()
    .trim()
    .min(1, 'Ingresa el precio')
    .transform((value, ctx) => {
      const price = parsePrice(value)
      if (price === null) {
        ctx.addIssue({ code: 'custom', message: PRICE_FORMAT_MESSAGE })
        return z.NEVER
      }
      return price
    })
    .pipe(z.number().max(99_999_999.99, 'El precio máximo es 99.999.999,99')),
  stock: z
    .string()
    .trim()
    .min(1, 'Ingresa el stock')
    .regex(/^\d+$/, 'El stock debe ser un número entero mayor o igual a 0')
    .transform(Number)
    .pipe(z.number().max(1_000_000, 'El stock máximo es 1.000.000')),
})

export type BookFormInput = z.input<typeof bookFormSchema>
export type BookFormOutput = z.output<typeof bookFormSchema>

export const emptyBookForm: BookFormInput = {
  title: '',
  authorName: '',
  publisherName: '',
  genreName: '',
  price: '',
  stock: '',
}

export function bookToFormValues(book: Book): BookFormInput {
  return {
    title: book.title,
    authorName: book.author.name,
    publisherName: book.publisher.name,
    genreName: book.genre.name,
    price: String(book.price),
    stock: String(book.stock),
  }
}
