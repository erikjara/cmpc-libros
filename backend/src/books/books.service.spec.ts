import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  mock,
  mockDeep,
  type DeepMockProxy,
  type MockProxy,
} from 'vitest-mock-extended';
import type { AuditService } from '../audit/audit.service.js';
import { PaginatedResult } from '../common/pagination/pagination.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  BOOK_ID,
  BOOK_INPUT,
  makeBook,
  REQUEST_CONTEXT,
} from '../testing/book-fixtures.js';
import { toBookDto } from './book.mapper.js';
import type { BooksRepository } from './books.repository.js';
import { BooksService } from './books.service.js';
import type { BookListQueryDto } from './dto/book-list-query.dto.js';

describe('BooksService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let tx: DeepMockProxy<Prisma.TransactionClient>;
  let repository: MockProxy<BooksRepository>;
  let audit: MockProxy<AuditService>;
  let service: BooksService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    tx = mockDeep<Prisma.TransactionClient>();
    // $transaction(fn) ejecuta el callback con nuestro tx falso.
    prisma.$transaction.mockImplementation(((
      fn: (client: typeof tx) => unknown,
    ) => fn(tx)) as never);
    repository = mock<BooksRepository>();
    audit = mock<AuditService>();
    service = new BooksService(prisma, repository, audit);
  });

  describe('list', () => {
    it('traduce filtros, pagina y devuelve PaginatedResult', async () => {
      repository.findPage.mockResolvedValue([[makeBook()], 21]);
      const query = {
        page: 3,
        limit: 10,
        available: 'true',
        sort: 'price:asc',
      } as BookListQueryDto;

      const result = await service.list(query);

      expect(repository.findPage).toHaveBeenCalledWith({
        where: { deletedAt: null, stock: { gt: 0 } },
        orderBy: [{ price: 'asc' }, { id: 'asc' }],
        skip: 20,
        take: 10,
      });
      expect(result).toBeInstanceOf(PaginatedResult);
      expect(result.meta).toEqual({
        page: 3,
        limit: 10,
        total: 21,
        totalPages: 3,
      });
      expect(result.items).toEqual([toBookDto(makeBook())]);
    });

    it('una página fuera de rango devuelve data vacía con meta correcta', async () => {
      repository.findPage.mockResolvedValue([[], 5]);
      const result = await service.list({
        page: 9,
        limit: 10,
      } as BookListQueryDto);
      expect(result.items).toEqual([]);
      expect(result.meta).toEqual({
        page: 9,
        limit: 10,
        total: 5,
        totalPages: 1,
      });
    });
  });

  describe('findOne', () => {
    it('devuelve el libro activo', async () => {
      repository.findActiveById.mockResolvedValue(makeBook());
      await expect(service.findOne(BOOK_ID)).resolves.toEqual(
        toBookDto(makeBook()),
      );
    });

    it('responde 404 si no existe o está eliminado', async () => {
      repository.findActiveById.mockResolvedValue(null);
      await expect(service.findOne(BOOK_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('crea y audita CREATE con el mismo tx', async () => {
      repository.create.mockResolvedValue(makeBook());

      const result = await service.create(BOOK_INPUT, REQUEST_CONTEXT);

      expect(repository.create).toHaveBeenCalledWith(tx, BOOK_INPUT);
      expect(audit.record).toHaveBeenCalledWith(tx, {
        action: 'CREATE',
        entity: 'Book',
        entityId: BOOK_ID,
        context: REQUEST_CONTEXT,
        changes: { after: toBookDto(makeBook()) },
      });
      expect(result).toEqual(toBookDto(makeBook()));
    });

    it('si la auditoría falla, el error se propaga (la transacción se revierte)', async () => {
      repository.create.mockResolvedValue(makeBook());
      audit.record.mockRejectedValue(new Error('db caída'));
      await expect(service.create(BOOK_INPUT, REQUEST_CONTEXT)).rejects.toThrow(
        'db caída',
      );
    });
  });

  describe('update', () => {
    it('rechaza un cuerpo sin campos', () => {
      expect(() => service.update(BOOK_ID, {}, REQUEST_CONTEXT)).toThrow(
        BadRequestException,
      );
      expect(() =>
        service.update(BOOK_ID, { title: undefined }, REQUEST_CONTEXT),
      ).toThrow('Debes enviar al menos un campo para actualizar');
    });

    it('actualiza y audita before/after con el mismo tx', async () => {
      const before = makeBook();
      const after = makeBook({ stock: 10 });
      repository.findActiveById.mockResolvedValue(before);
      repository.update.mockResolvedValue(after);

      const result = await service.update(
        BOOK_ID,
        { stock: 10 },
        REQUEST_CONTEXT,
      );

      expect(repository.findActiveById).toHaveBeenCalledWith(BOOK_ID, tx);
      expect(repository.update).toHaveBeenCalledWith(tx, BOOK_ID, {
        stock: 10,
      });
      expect(audit.record).toHaveBeenCalledWith(tx, {
        action: 'UPDATE',
        entity: 'Book',
        entityId: BOOK_ID,
        context: REQUEST_CONTEXT,
        changes: { before: toBookDto(before), after: toBookDto(after) },
      });
      expect(result.stock).toBe(10);
    });

    it('responde 404 si el libro no existe y no audita', async () => {
      repository.findActiveById.mockResolvedValue(null);
      await expect(
        service.update(BOOK_ID, { stock: 1 }, REQUEST_CONTEXT),
      ).rejects.toThrow(NotFoundException);
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('hace soft delete y audita DELETE con el mismo tx', async () => {
      repository.findActiveById.mockResolvedValue(makeBook());

      await service.remove(BOOK_ID, REQUEST_CONTEXT);

      expect(repository.softDelete).toHaveBeenCalledWith(tx, BOOK_ID);
      expect(audit.record).toHaveBeenCalledWith(tx, {
        action: 'DELETE',
        entity: 'Book',
        entityId: BOOK_ID,
        context: REQUEST_CONTEXT,
        changes: { before: toBookDto(makeBook()) },
      });
    });

    it('responde 404 si ya estaba eliminado', async () => {
      repository.findActiveById.mockResolvedValue(null);
      await expect(service.remove(BOOK_ID, REQUEST_CONTEXT)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('restore', () => {
    it('restaura un libro eliminado y audita RESTORE con el mismo tx', async () => {
      repository.findAnyById.mockResolvedValue(
        makeBook({ deletedAt: new Date() }),
      );
      repository.restore.mockResolvedValue(makeBook());

      const result = await service.restore(BOOK_ID, REQUEST_CONTEXT);

      expect(repository.findAnyById).toHaveBeenCalledWith(BOOK_ID, tx);
      expect(repository.restore).toHaveBeenCalledWith(tx, BOOK_ID);
      expect(audit.record).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ action: 'RESTORE' }),
      );
      expect(result).toEqual(toBookDto(makeBook()));
    });

    it('es idempotente si el libro no estaba eliminado', async () => {
      repository.findAnyById.mockResolvedValue(makeBook());
      await expect(service.restore(BOOK_ID, REQUEST_CONTEXT)).resolves.toEqual(
        toBookDto(makeBook()),
      );
      expect(repository.restore).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('responde 404 si el libro no existe', async () => {
      repository.findAnyById.mockResolvedValue(null);
      await expect(service.restore(BOOK_ID, REQUEST_CONTEXT)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
