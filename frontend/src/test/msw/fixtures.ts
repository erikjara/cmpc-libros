import type { Book, CatalogItem, User } from '@/lib/api-types'

export const adminUser: User = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'admin@cmpc.cl',
  name: 'Administrador',
}

export const ADMIN_PASSWORD = 'Admin123!'

export const authors: CatalogItem[] = [
  { id: '10000000-0000-4000-8000-000000000001', name: 'Gabriel García Márquez' },
  { id: '10000000-0000-4000-8000-000000000002', name: 'Isabel Allende' },
  { id: '10000000-0000-4000-8000-000000000003', name: 'Pablo Neruda' },
]

export const publishers: CatalogItem[] = [
  { id: '20000000-0000-4000-8000-000000000001', name: 'Editorial Sudamericana' },
  { id: '20000000-0000-4000-8000-000000000002', name: 'Plaza & Janés' },
]

export const genres: CatalogItem[] = [
  { id: '30000000-0000-4000-8000-000000000001', name: 'Novela' },
  { id: '30000000-0000-4000-8000-000000000002', name: 'Poesía' },
]

function makeBook(
  index: number,
  overrides: Partial<Book> & Pick<Book, 'title' | 'author' | 'publisher' | 'genre'>,
): Book {
  const stock = overrides.stock ?? index % 4
  const createdAt = new Date(Date.UTC(2026, 0, index + 1)).toISOString()
  return {
    id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    price: 10000 + index * 1000,
    stock,
    available: stock > 0,
    imageUrl: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  }
}

export function buildBooks(): Book[] {
  const named: Book[] = [
    makeBook(0, {
      title: 'Cien años de soledad',
      author: authors[0],
      publisher: publishers[0],
      genre: genres[0],
      price: 15990,
      stock: 5,
      imageUrl: '/api/uploads/cien-anos.webp',
    }),
    makeBook(1, {
      title: 'La casa de los espíritus',
      author: authors[1],
      publisher: publishers[1],
      genre: genres[0],
      price: 12990,
      stock: 0,
    }),
    makeBook(2, {
      title: 'Veinte poemas de amor',
      author: authors[2],
      publisher: publishers[0],
      genre: genres[1],
      price: 8990,
      stock: 3,
    }),
  ]
  const filler = Array.from({ length: 22 }, (_, i) =>
    makeBook(i + 3, {
      title: `Libro de prueba ${String(i + 1).padStart(2, '0')}`,
      author: authors[i % authors.length],
      publisher: publishers[i % publishers.length],
      genre: genres[i % genres.length],
    }),
  )
  return [...named, ...filler]
}
