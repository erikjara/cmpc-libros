import type { AuditAction } from '../generated/prisma/client.js';
import { toUserDto, type UserDto } from '../users/user.mapper.js';
import type { AuditLogWithUser } from './audit-logs.repository.js';

export interface AuditLogDto {
  id: string;
  action: AuditAction;
  entity: string;
  entityId: string | null;
  user: UserDto | null;
  changes: unknown;
  ip: string | null;
  createdAt: string;
}

export function toAuditLogDto(log: AuditLogWithUser): AuditLogDto {
  return {
    id: log.id,
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    user: log.user ? toUserDto(log.user) : null,
    changes: log.changes ?? null,
    ip: log.ip,
    createdAt: log.createdAt.toISOString(),
  };
}
