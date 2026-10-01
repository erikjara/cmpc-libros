import type { AuditLog, AuditLogQuery, PaginatedResponse } from '@/lib/api-types'
import { httpClient } from '@/lib/http-client'
import { toQueryString } from '@/lib/query-string'

export async function fetchAuditLogs(query: AuditLogQuery): Promise<PaginatedResponse<AuditLog[]>> {
  const response = await httpClient.get<PaginatedResponse<AuditLog[]>>(`/audit-logs?${toQueryString(query)}`)
  return response.data
}
