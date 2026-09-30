import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DbClient } from '../prisma/prisma.types.js';

const AUDIT_LOG_INCLUDE = { user: true } satisfies Prisma.AuditLogInclude;

export type AuditLogWithUser = Prisma.AuditLogGetPayload<{
  include: typeof AUDIT_LOG_INCLUDE;
}>;

export interface AuditLogSearch {
  where: Prisma.AuditLogWhereInput;
  skip: number;
  take: number;
}

@Injectable()
export class AuditLogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    db: DbClient,
    data: Prisma.AuditLogUncheckedCreateInput,
  ): Promise<void> {
    await db.auditLog.create({ data });
  }

  async findMany(
    search: AuditLogSearch,
  ): Promise<[AuditLogWithUser[], number]> {
    return this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where: search.where,
        include: AUDIT_LOG_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: search.skip,
        take: search.take,
      }),
      this.prisma.auditLog.count({ where: search.where }),
    ]);
  }
}
