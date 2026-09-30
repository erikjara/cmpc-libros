import type { Readable } from 'node:stream';
import { BadRequestException, Logger } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { makeBook, REQUEST_CONTEXT } from '../testing/book-fixtures.js';
import {
  BooksExportService,
  EXPORT_BATCH_SIZE,
} from './books-export.service.js';
import type { BooksRepository } from './books.repository.js';

async function readAll(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk as Buffer));
  }
  return Buffer.concat(chunks).toString('utf8');
}

describe('BooksExportService', () => {
  let repository: MockProxy<BooksRepository>;
  let audit: MockProxy<AuditService>;
  let prisma: PrismaService;
  let service: BooksExportService;

  beforeEach(() => {
    repository = mock<BooksRepository>();
    audit = mock<AuditService>();
    prisma = {} as PrismaService;
    service = new BooksExportService(prisma, repository, audit);
  });

  it('escribe BOM, encabezados del contrato y escapa comas y comillas (RFC 4180)', async () => {
    repository.findBatch.mockResolvedValueOnce([
      makeBook({ title: 'El "gran" libro, parte 1' }),
    ]);

    const csv = await readAll(
      await service.createCsvStream({}, REQUEST_CONTEXT),
    );

    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).trim().split('\n');
    expect(lines[0]).toBe(
      'ID,Título,Autor,Editorial,Género,Precio,Stock,Disponible,Creado',
    );
    expect(lines[1]).toBe(
      '3f2b8a54-5f0e-4f7c-9a57-3a5f9b2f6e10,"El ""gran"" libro, parte 1",Isabel Allende,Sudamericana,Realismo mágico,15990.50,3,Sí,2026-09-01T10:00:00.000Z',
    );
  });

  it('lee por lotes usando el último id como cursor', async () => {
    const fullBatch = Array.from({ length: EXPORT_BATCH_SIZE }, (_, index) =>
      makeBook({ id: `id-${index}` }),
    );
    repository.findBatch
      .mockResolvedValueOnce(fullBatch)
      .mockResolvedValueOnce([makeBook({ id: 'final' })]);

    const csv = await readAll(
      await service.createCsvStream({ available: 'true' }, REQUEST_CONTEXT),
    );

    expect(repository.findBatch).toHaveBeenCalledTimes(2);
    expect(repository.findBatch.mock.calls[0][0]).toMatchObject({
      where: { deletedAt: null, stock: { gt: 0 } },
      take: EXPORT_BATCH_SIZE,
      cursor: undefined,
    });
    expect(repository.findBatch.mock.calls[1][0].cursor).toBe(
      `id-${EXPORT_BATCH_SIZE - 1}`,
    );
    expect(csv.trim().split('\n')).toHaveLength(EXPORT_BATCH_SIZE + 2);
  });

  it('con cero resultados entrega solo los encabezados', async () => {
    repository.findBatch.mockResolvedValueOnce([]);
    const csv = await readAll(
      await service.createCsvStream({}, REQUEST_CONTEXT),
    );
    expect(csv.slice(1).trim()).toBe(
      'ID,Título,Autor,Editorial,Género,Precio,Stock,Disponible,Creado',
    );
  });

  it('registra EXPORT con los filtros usados', async () => {
    repository.findBatch.mockResolvedValueOnce([]);
    await readAll(
      await service.createCsvStream({ search: 'allende' }, REQUEST_CONTEXT),
    );
    expect(audit.record).toHaveBeenCalledWith(prisma, {
      action: 'EXPORT',
      entity: 'Book',
      entityId: null,
      context: REQUEST_CONTEXT,
      changes: { filters: { search: 'allende' } },
    });
  });

  it('valida el sort antes de auditar o abrir el stream', async () => {
    await expect(
      service.createCsvStream(
        { sort: 'price:asc,price:desc' },
        REQUEST_CONTEXT,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('si falla la lectura a mitad de camino, el stream termina con error', async () => {
    repository.findBatch.mockRejectedValueOnce(new Error('db caída'));
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const stream = await service.createCsvStream({}, REQUEST_CONTEXT);
    await expect(readAll(stream)).rejects.toThrow('db caída');
  });
});
