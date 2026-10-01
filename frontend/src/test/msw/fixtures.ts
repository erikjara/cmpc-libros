import type { AuditLog, Book, CatalogItem, User } from '@/lib/api-types'

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

// Registros de auditoría con la forma que guarda la API: CREATE/RESTORE con `after`, DELETE con
// `before`, UPDATE con ambos y EXPORT con los filtros. Ordenados del más reciente al más antiguo.
export function buildAuditLogs(): AuditLog[] {
  const [cien, casa, veinte] = buildBooks()
  const at = (minute: number) => new Date(Date.UTC(2026, 8, 30, 12, minute)).toISOString()
  const base = { user: adminUser, ip: '192.168.1.10' }
  const logs: AuditLog[] = [
    {
      ...base,
      id: 'a0000000-0000-4000-8000-000000000001',
      action: 'UPDATE',
      entity: 'Book',
      entityId: cien.id,
      changes: { before: { ...cien }, after: { ...cien, stock: 0, price: 12990, available: false } },
      createdAt: at(50),
    },
    {
      ...base,
      id: 'a0000000-0000-4000-8000-000000000002',
      action: 'EXPORT',
      entity: 'Book',
      entityId: null,
      changes: { filters: { search: 'neruda', available: 'true', sort: 'title:asc' } },
      createdAt: at(45),
    },
    {
      ...base,
      id: 'a0000000-0000-4000-8000-000000000003',
      action: 'RESTORE',
      entity: 'Book',
      entityId: casa.id,
      changes: { after: { ...casa } },
      createdAt: at(40),
    },
    {
      ...base,
      id: 'a0000000-0000-4000-8000-000000000004',
      action: 'DELETE',
      entity: 'Book',
      entityId: casa.id,
      changes: { before: { ...casa } },
      createdAt: at(35),
    },
    {
      ...base,
      id: 'a0000000-0000-4000-8000-000000000005',
      action: 'CREATE',
      entity: 'Book',
      entityId: veinte.id,
      changes: { after: { ...veinte } },
      createdAt: at(30),
    },
    {
      ...base,
      id: 'a0000000-0000-4000-8000-000000000006',
      action: 'LOGIN',
      entity: 'User',
      entityId: adminUser.id,
      changes: null,
      createdAt: at(25),
    },
  ]
  const filler: AuditLog[] = Array.from({ length: 10 }, (_, i) => ({
    id: `a0000000-0000-4000-8000-${String(100 + i).padStart(12, '0')}`,
    action: 'LOGIN',
    entity: 'User',
    entityId: adminUser.id,
    user: i === 0 ? null : adminUser,
    changes: null,
    ip: i === 0 ? null : '10.0.0.1',
    createdAt: at(20 - i),
  }))
  return [...logs, ...filler]
}
