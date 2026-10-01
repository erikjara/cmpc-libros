import { beforeEach, describe, expect, it } from 'vitest';
import {
  mock,
  mockDeep,
  type DeepMockProxy,
  type MockProxy,
} from 'vitest-mock-extended';
import { PaginatedResult } from '../common/pagination/pagination.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { toAuditLogDto } from './audit-log.mapper.js';
import { AuditLogsController } from './audit-logs.controller.js';
import {
  AuditLogsRepository,
  type AuditLogWithUser,
} from './audit-logs.repository.js';
import { AuditService } from './audit.service.js';
import type { AuditLogQueryDto } from './dto/audit-log-query.dto.js';

const context = { userId: 'u1', ip: '10.0.0.1', userAgent: 'vitest' };

const log: AuditLogWithUser = {
  id: 'a1',
  userId: 'u1',
  action: 'UPDATE',
  entity: 'Book',
  entityId: 'b1',
  changes: { before: { stock: 1 }, after: { stock: 2 } },
  ip: '10.0.0.1',
  userAgent: 'vitest',
  createdAt: new Date('2026-09-30T12:00:00.000Z'),
  user: {
    id: 'u1',
    email: 'admin@cmpc.cl',
    name: 'Administrador',
    passwordHash: 'hash',
    tokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

function query(partial: Partial<AuditLogQueryDto> = {}): AuditLogQueryDto {
  return { page: 1, limit: 10, ...partial } as AuditLogQueryDto;
}

describe('AuditService', () => {
  let repository: MockProxy<AuditLogsRepository>;
  let service: AuditService;

  beforeEach(() => {
    repository = mock<AuditLogsRepository>();
    service = new AuditService(repository);
  });

  it('record usa el mismo cliente transaccional que recibe', async () => {
    const tx = mockDeep<Prisma.TransactionClient>();

    await service.record(tx, {
      action: 'CREATE',
      entity: 'Book',
      entityId: 'b1',
      context,
      changes: { after: { title: 'Rayuela' } },
    });

    expect(repository.create).toHaveBeenCalledWith(tx, {
      action: 'CREATE',
      entity: 'Book',
      entityId: 'b1',
      userId: 'u1',
      ip: '10.0.0.1',
      userAgent: 'vitest',
      changes: { after: { title: 'Rayuela' } },
    });
  });

  it('list pagina y filtra por entidad', async () => {
    repository.findMany.mockResolvedValue([[log], 11]);

    const result = await service.list(
      query({ page: 2, entity: 'Book', entityId: 'b1' }),
    );

    expect(repository.findMany).toHaveBeenCalledWith({
      where: { entity: 'Book', entityId: 'b1' },
      skip: 10,
      take: 10,
    });
    expect(result).toBeInstanceOf(PaginatedResult);
    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 11,
      totalPages: 2,
    });
    expect(result.items[0].user).toEqual({
      id: 'u1',
      email: 'admin@cmpc.cl',
      name: 'Administrador',
    });
  });

  it('list sin filtros usa where vacío', async () => {
    repository.findMany.mockResolvedValue([[], 0]);
    await service.list(query());
    expect(repository.findMany).toHaveBeenCalledWith({
      where: {},
      skip: 0,
      take: 10,
    });
  });
});

describe('toAuditLogDto', () => {
  it('serializa fechas y usuario nulo', () => {
    const dto = toAuditLogDto({
      ...log,
      user: null,
      userId: null,
      changes: null,
    });
    expect(dto).toEqual({
      id: 'a1',
      action: 'UPDATE',
      entity: 'Book',
      entityId: 'b1',
      user: null,
      changes: null,
      ip: '10.0.0.1',
      createdAt: '2026-09-30T12:00:00.000Z',
    });
  });
});

describe('AuditLogsRepository', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let repository: AuditLogsRepository;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    repository = new AuditLogsRepository(prisma);
  });

  it('create escribe con el cliente recibido', async () => {
    const tx = mockDeep<Prisma.TransactionClient>();
    const data = { action: 'LOGIN' as const, entity: 'User', entityId: 'u1' };
    await repository.create(tx, data);
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('findMany ordena por fecha descendente y cuenta en una transacción', async () => {
    prisma.$transaction.mockResolvedValue([[log], 1] as never);
    const result = await repository.findMany({ where: {}, skip: 0, take: 10 });
    expect(result).toEqual([[log], 1]);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {},
      include: { user: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: 0,
      take: 10,
    });
    expect(prisma.auditLog.count).toHaveBeenCalledWith({ where: {} });
  });
});

describe('AuditLogsController', () => {
  it('delega en AuditService.list', async () => {
    const service = mock<AuditService>();
    const expected = new PaginatedResult([], {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    });
    service.list.mockResolvedValue(expected);
    const controller = new AuditLogsController(service);
    await expect(controller.list(query())).resolves.toBe(expected);
  });
});
