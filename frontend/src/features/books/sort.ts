import type { SortingState } from '@tanstack/react-table'
import type { SortField } from '@/lib/api-types'

export const SORT_FIELDS: readonly SortField[] = [
  'title',
  'price',
  'stock',
  'createdAt',
  'author',
  'publisher',
  'genre',
]

function isSortField(value: string): value is SortField {
  return (SORT_FIELDS as readonly string[]).includes(value)
}

// "price:desc,title:asc" → [{ id: 'price', desc: true }, { id: 'title', desc: false }].
// Descarta segmentos inválidos y campos repetidos para no enviar un sort que el backend rechace.
export function parseSort(raw: string | null | undefined): SortingState {
  if (!raw) return []
  const seen = new Set<string>()
  const sorting: SortingState = []
  for (const segment of raw.split(',')) {
    const [field, direction] = segment.split(':')
    if (!field || !isSortField(field) || (direction !== 'asc' && direction !== 'desc')) continue
    if (seen.has(field)) continue
    seen.add(field)
    sorting.push({ id: field, desc: direction === 'desc' })
  }
  return sorting
}

export function serializeSort(sorting: SortingState): string | undefined {
  const valid = sorting.filter((item) => isSortField(item.id))
  if (valid.length === 0) return undefined
  return valid.map((item) => `${item.id}:${item.desc ? 'desc' : 'asc'}`).join(',')
}
