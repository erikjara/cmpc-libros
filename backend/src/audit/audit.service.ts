import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import {
  buildPaginationMeta,
  PaginatedResult,
  toSkipTake,
} from '../common/pagination/pagination.js';
import type { DbClient } from '../prisma/prisma.types.js';
import { toAuditLogDto, type AuditLogDto } from './audit-log.mapper.js';
import { AuditLogsRepository } from './audit-logs.repository.js';
import type { AuditEntry } from './audit.types.js';
import type { AuditLogQueryDto } from './dto/audit-log-query.dto.js';

@Injectable()
export class AuditService {
  constructor(private readonly repository: AuditLogsRepository) {}

  /** Registra la operación usando el mismo cliente (`tx`) que el cambio auditado. */
  async record(db: DbClient, entry: AuditEntry): Promise<void> {
    await this.repository.create(db, {
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      userId: entry.context.userId,
      ip: entry.context.ip,
      userAgent: entry.context.userAgent,
      changes: entry.changes as Prisma.InputJsonValue | undefined,
    });
  }

  async list(query: AuditLogQueryDto): Promise<PaginatedResult<AuditLogDto>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.entity ? { entity: query.entity } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
    };
    const [logs, total] = await this.repository.findMany({
      where,
      ...toSkipTake(query.page, query.limit),
    });
    return new PaginatedResult(
      logs.map(toAuditLogDto),
      buildPaginationMeta(query.page, query.limit, total),
    );
  }
}
