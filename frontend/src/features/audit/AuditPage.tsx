import { useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AuditAction, AuditEntity, AuditLog } from '@/lib/api-types'
import { formatDateTime } from '@/lib/formatters'
import { EmptyState } from '@/shared/EmptyState'
import { ListPagination } from '@/shared/ListPagination'
import { QueryError } from '@/shared/QueryError'
import { TableSkeleton } from '@/shared/TableSkeleton'
import { usePaginatedSearchParams } from '@/shared/usePaginatedSearchParams'
import { useAuditLogsQuery } from './audit.queries'
import { summarizeChanges } from './audit-summary'

const NOUN = ['registro', 'registros'] as const
const ALL = 'all'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

const ACTIONS: Record<AuditAction, { label: string; variant: BadgeVariant }> = {
  CREATE: { label: 'Alta', variant: 'default' },
  UPDATE: { label: 'Edición', variant: 'secondary' },
  DELETE: { label: 'Eliminación', variant: 'destructive' },
  RESTORE: { label: 'Restauración', variant: 'outline' },
  EXPORT: { label: 'Exportación', variant: 'outline' },
  LOGIN: { label: 'Inicio de sesión', variant: 'secondary' },
}

const ENTITY_LABELS: Record<string, string> = { Book: 'Libro', User: 'Usuario' }

const ENTITY_ITEMS = [
  { value: ALL, label: 'Todos' },
  { value: 'Book', label: 'Libros' },
  { value: 'User', label: 'Usuarios' },
]

function parseEntity(raw: string | null): AuditEntity | undefined {
  return raw === 'Book' || raw === 'User' ? raw : undefined
}

function ActionBadge({ action }: { action: AuditAction }) {
  const config = ACTIONS[action] ?? { label: action, variant: 'outline' }
  return <Badge variant={config.variant}>{config.label}</Badge>
}

function AuditTable({ logs }: { logs: AuditLog[] }) {
  return (
    <Table className="min-w-[860px] table-fixed">
      <colgroup>
        <col style={{ width: '16%' }} />
        <col style={{ width: '13%' }} />
        <col style={{ width: '9%' }} />
        <col style={{ width: '13%' }} />
        <col style={{ width: '12%' }} />
        <col style={{ width: '37%' }} />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Acción</TableHead>
          <TableHead>Entidad</TableHead>
          <TableHead>Usuario</TableHead>
          <TableHead>IP</TableHead>
          <TableHead>Cambios</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell>
              <time dateTime={log.createdAt}>{formatDateTime(log.createdAt)}</time>
            </TableCell>
            <TableCell>
              <ActionBadge action={log.action} />
            </TableCell>
            <TableCell>{ENTITY_LABELS[log.entity] ?? log.entity}</TableCell>
            <TableCell className="whitespace-normal break-words">{log.user?.name ?? '—'}</TableCell>
            <TableCell className="font-mono text-xs">{log.ip ?? '—'}</TableCell>
            <TableCell className="whitespace-normal break-words text-muted-foreground">
              {summarizeChanges(log)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function AuditPage() {
  const { searchParams, page, limit, setPage, setLimit, setParam } = usePaginatedSearchParams()
  const entity = parseEntity(searchParams.get('entity'))
  const auditQuery = useAuditLogsQuery({ page, limit, ...(entity ? { entity } : {}) })
  const result = auditQuery.data
  const lastPage = result && result.data.length === 0 && result.meta.total > 0 ? result.meta.totalPages : null
  const redirectPage = auditQuery.isPlaceholderData ? null : lastPage

  useEffect(() => {
    if (redirectPage !== null) setPage(redirectPage, { replace: true })
  }, [redirectPage, setPage])

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Auditoría</h1>
        <p className="text-sm text-muted-foreground">Altas, ediciones, eliminaciones, exportaciones e inicios de sesión.</p>
      </div>

      <div className="flex w-full flex-col gap-1.5 sm:max-w-xs">
        <Label htmlFor="audit-entity">Entidad</Label>
        <Select
          items={ENTITY_ITEMS}
          value={entity ?? ALL}
          onValueChange={(value) => setParam('entity', parseEntity(value))}
        >
          <SelectTrigger id="audit-entity" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(auditQuery.isPending || lastPage !== null) && <TableSkeleton />}

      {auditQuery.isError && (
        <QueryError error={auditQuery.error} onRetry={() => void auditQuery.refetch()} title="No se pudo cargar la auditoría" />
      )}

      {result && result.meta.total === 0 && <EmptyState title="No hay registros de auditoría" />}

      {result && result.data.length > 0 && (
        <div className={auditQuery.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined} aria-busy={auditQuery.isFetching}>
          <AuditTable logs={result.data} />
        </div>
      )}

      {result && result.meta.total > 0 && (
        <ListPagination meta={result.meta} onPageChange={setPage} onLimitChange={setLimit} noun={NOUN} />
      )}
    </section>
  )
}
