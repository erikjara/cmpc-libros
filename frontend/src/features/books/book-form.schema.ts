import * as z from 'zod'
import type { Book } from '@/lib/api-types'

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
    .regex(/^\d+([.,]\d{1,2})?$/, 'Ingresa un número mayor o igual a 0, con hasta 2 decimales')
    .transform((value) => Number(value.replace(',', '.')))
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
