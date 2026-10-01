import type { Readable } from 'node:stream';
import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditService } from '../audit/audit.service.js';
import { Prisma } from '../generated/prisma/client.js';
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

  it('escribe BOM, encabezados de la API con ";" y escapa ";" y comillas (RFC 4180)', async () => {
    repository.findBatch.mockResolvedValueOnce([
      makeBook({ title: 'El "gran" libro; parte 1' }),
      makeBook({ title: 'Uno, dos', price: new Prisma.Decimal('15990') }),
    ]);

    const csv = await readAll(
      await service.createCsvStream({}, REQUEST_CONTEXT),
    );

    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).trim().split('\n');
    expect(lines[0]).toBe(
      'ID;Título;Autor;Editorial;Género;Precio;Stock;Disponible;Creado',
    );
    expect(lines[1]).toBe(
      '3f2b8a54-5f0e-4f7c-9a57-3a5f9b2f6e10;"El ""gran"" libro; parte 1";Isabel Allende;Sudamericana;Realismo mágico;15990,50;3;Sí;2026-09-01T10:00:00.000Z',
    );
    // La coma ya no es delimitador: el texto no necesita comillas.
    expect(lines[2]).toBe(
      '3f2b8a54-5f0e-4f7c-9a57-3a5f9b2f6e10;Uno, dos;Isabel Allende;Sudamericana;Realismo mágico;15990;3;Sí;2026-09-01T10:00:00.000Z',
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
      'ID;Título;Autor;Editorial;Género;Precio;Stock;Disponible;Creado',
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

  it('lee el primer lote antes de devolver el stream: si falla, rechaza sin auditar', async () => {
    repository.findBatch.mockRejectedValueOnce(new Error('db caída'));

    await expect(service.createCsvStream({}, REQUEST_CONTEXT)).rejects.toThrow(
      'db caída',
    );
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('si falla un lote posterior, el stream termina con ese error', async () => {
    repository.findBatch
      .mockResolvedValueOnce(
        Array.from({ length: EXPORT_BATCH_SIZE }, (_, index) =>
          makeBook({ id: `id-${index}` }),
        ),
      )
      .mockRejectedValueOnce(new Error('db caída'));

    const stream = await service.createCsvStream({}, REQUEST_CONTEXT);

    await expect(readAll(stream)).rejects.toThrow('db caída');
  });

  it('si el consumidor destruye el stream, deja de leer lotes', async () => {
    repository.findBatch.mockResolvedValue(
      Array.from({ length: EXPORT_BATCH_SIZE }, (_, index) =>
        makeBook({ id: `id-${index}` }),
      ),
    );

    const stream = await service.createCsvStream({}, REQUEST_CONTEXT);
    stream.destroy();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(repository.findBatch.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
