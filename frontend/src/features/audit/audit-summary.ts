import type { AuditLog } from '@/lib/api-types'
import { formatCLP } from '@/lib/formatters'

const EMPTY = '—'
const SEPARATOR = ' · '

// Orden y etiquetas de los campos de un libro; el resto se muestra con su nombre original.
const FIELD_LABELS: Record<string, string> = {
  title: 'título',
  author: 'autor',
  publisher: 'editorial',
  genre: 'género',
  price: 'precio',
  stock: 'stock',
}
const IMAGE_FIELDS = new Set(['imageKey', 'imageUrl'])
// Metadatos o valores derivados que no aportan al resumen (available depende de stock).
const IGNORED_FIELDS = new Set(['id', 'createdAt', 'updatedAt', 'deletedAt', 'available'])

const FILTER_LABELS: Record<string, string> = {
  search: 'búsqueda',
  available: 'disponibilidad',
  sort: 'orden',
  authorId: 'autor',
  publisherId: 'editorial',
  genreId: 'género',
}
const AVAILABILITY_LABELS: Record<string, string> = { true: 'disponibles', false: 'agotados' }
const SORT_FIELD_LABELS: Record<string, string> = { ...FIELD_LABELS, createdAt: 'fecha de creación' }
const ID_PREVIEW_LENGTH = 8

type Changes = Record<string, unknown>

function isRecord(value: unknown): value is Changes {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return EMPTY
  if (field === 'price' && typeof value === 'number') return formatCLP(value)
  if (isRecord(value) && typeof value.name === 'string') return value.name
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function summarizeUpdate(before: Changes, after: Changes): string {
  const keys = new Set([...Object.keys(FIELD_LABELS), ...Object.keys(before), ...Object.keys(after)])
  const parts = new Set<string>()
  for (const key of keys) {
    if (IGNORED_FIELDS.has(key) || !(key in before || key in after)) continue
    const previous = formatValue(key, before[key])
    const next = formatValue(key, after[key])
    if (previous === next) continue
    if (IMAGE_FIELDS.has(key)) parts.add(next === EMPTY ? 'imagen eliminada' : 'imagen actualizada')
    else parts.add(`${FIELD_LABELS[key] ?? key}: ${previous} → ${next}`)
  }
  return parts.size > 0 ? [...parts].join(SEPARATOR) : 'Sin cambios'
}

function formatSort(sort: string): string {
  return sort
    .split(',')
    .map((part) => {
      const [field, direction] = part.split(':')
      return `${SORT_FIELD_LABELS[field] ?? field} ${direction === 'desc' ? '↓' : '↑'}`
    })
    .join(', ')
}

function formatFilter(key: string, value: unknown): string {
  const text = String(value)
  if (key === 'available') return AVAILABILITY_LABELS[text] ?? text
  if (key === 'sort') return formatSort(text)
  if (key.endsWith('Id') && text.length > ID_PREVIEW_LENGTH) return `${text.slice(0, ID_PREVIEW_LENGTH)}…`
  return text
}

function summarizeExport(filters: unknown): string {
  if (!isRecord(filters)) return 'Sin filtros'
  const parts = Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${FILTER_LABELS[key] ?? key}: ${formatFilter(key, value)}`)
  return parts.length > 0 ? parts.join(SEPARATOR) : 'Sin filtros'
}

function titleOf(snapshot: unknown): string | undefined {
  return isRecord(snapshot) && typeof snapshot.title === 'string' ? snapshot.title : undefined
}

/**
 * Resumen legible de `changes` de un registro de auditoría: campos modificados en una edición,
 * título del libro en altas, eliminaciones y restauraciones, y filtros en una exportación.
 */
export function summarizeChanges(log: Pick<AuditLog, 'action' | 'changes'>): string {
  const changes = isRecord(log.changes) ? log.changes : undefined
  switch (log.action) {
    case 'UPDATE':
      return changes && isRecord(changes.before) && isRecord(changes.after)
        ? summarizeUpdate(changes.before, changes.after)
        : EMPTY
    case 'CREATE':
    case 'DELETE':
    case 'RESTORE':
      return titleOf(changes?.after) ?? titleOf(changes?.before) ?? EMPTY
    case 'EXPORT':
      return summarizeExport(changes?.filters)
    default:
      return EMPTY
  }
}
