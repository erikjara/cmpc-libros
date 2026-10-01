import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { AuditLogQuery } from '@/lib/api-types'
import { fetchAuditLogs } from './audit.api'

export const auditKeys = {
  all: ['audit-logs'] as const,
  list: (query: AuditLogQuery) => ['audit-logs', 'list', query] as const,
}

export function useAuditLogsQuery(query: AuditLogQuery) {
  return useQuery({
    queryKey: auditKeys.list(query),
    queryFn: () => fetchAuditLogs(query),
    placeholderData: keepPreviousData,
    // Cualquier operación sobre libros agrega registros: se consulta de nuevo al volver a la página.
    staleTime: 0,
  })
}
