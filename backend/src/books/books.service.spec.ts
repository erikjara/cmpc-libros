import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  PreconditionFailedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mock,
  mockDeep,
  type DeepMockProxy,
  type MockProxy,
} from 'vitest-mock-extended';
import type { AuditService } from '../audit/audit.service.js';
import { parseIfMatch } from '../common/http/etag.js';
import { PaginatedResult } from '../common/pagination/pagination.js';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { StorageService } from '../storage/storage.service.js';
import {
  BOOK_ID,
  BOOK_INPUT,
  makeBook,
  REQUEST_CONTEXT,
} from '../testing/book-fixtures.js';
import { JPEG_BYTES } from '../testing/image-fixtures.js';
import { toBookDto, toTrashedBookDto } from './book.mapper.js';
import type { BooksRepository } from './books.repository.js';
import { BOOK_MODIFIED, BooksService } from './books.service.js';
import type { BookListQueryDto } from './dto/book-list-query.dto.js';
import type { TrashQueryDto } from './dto/trash-query.dto.js';

function uniqueViolation(modelName: string, table: string) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.10.0',
    meta: {
      modelName,
      driverAdapterError: {
        cause: { kind: 'UniqueConstraintViolation', table },
      },
    },
  });
}

describe('BooksService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let tx: DeepMockProxy<Prisma.TransactionClient>;
  let repository: MockProxy<BooksRepository>;
  let audit: MockProxy<AuditService>;
  let storage: MockProxy<StorageService>;
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
    storage = mock<StorageService>();
    repository.lockIfUnchanged.mockResolvedValue(true);
    service = new BooksService(prisma, repository, audit, storage);
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

  describe('listTrash', () => {
    it('pagina los eliminados con la búsqueda y agrega deletedAt', async () => {
      const deletedAt = new Date('2026-09-20T15:30:00.000Z');
      const deleted = { ...makeBook({ deletedAt }), deletedAt };
      repository.findTrashPage.mockResolvedValue([[deleted], 11]);

      const result = await service.listTrash({
        page: 2,
        limit: 5,
        search: 'allende',
      } as TrashQueryDto);

      expect(repository.findTrashPage).toHaveBeenCalledWith({
        search: 'allende',
        skip: 5,
        take: 5,
      });
      expect(result).toBeInstanceOf(PaginatedResult);
      expect(result.items).toEqual([toTrashedBookDto(deleted)]);
      expect(result.meta).toEqual({
        page: 2,
        limit: 5,
        total: 11,
        totalPages: 3,
      });
    });

    it('no audita (es una lectura)', async () => {
      repository.findTrashPage.mockResolvedValue([[], 0]);
      const result = await service.listTrash({
        page: 1,
        limit: 10,
      } as TrashQueryDto);
      expect(result.items).toEqual([]);
      expect(result.meta.totalPages).toBe(0);
      expect(audit.record).not.toHaveBeenCalled();
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

  describe('carrera al crear autor, editorial o género por nombre', () => {
    it.each([
      ['Author', 'authors'],
      ['Publisher', 'publishers'],
      ['Genre', 'genres'],
    ])(
      'create reintenta una vez la transacción completa ante P2002 en %s',
      async (model, table) => {
        repository.create
          .mockRejectedValueOnce(uniqueViolation(model, table))
          .mockResolvedValueOnce(makeBook());

        await expect(
          service.create(BOOK_INPUT, REQUEST_CONTEXT),
        ).resolves.toEqual(toBookDto(makeBook()));
        expect(prisma.$transaction).toHaveBeenCalledTimes(2);
        expect(audit.record).toHaveBeenCalledOnce();
      },
    );

    it('update reintenta una vez ante P2002 en un catálogo', async () => {
      repository.findActiveById.mockResolvedValue(makeBook());
      repository.update
        .mockRejectedValueOnce(uniqueViolation('Author', 'authors'))
        .mockResolvedValueOnce(makeBook({ stock: 9 }));

      const result = await service.update(
        BOOK_ID,
        { authorName: 'Autor nuevo' },
        REQUEST_CONTEXT,
      );

      expect(result.stock).toBe(9);
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('reconoce la tabla aunque falte modelName', async () => {
      const error = uniqueViolation('Genre', 'genres');
      delete (error.meta as Record<string, unknown>).modelName;
      repository.create
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(makeBook());

      await service.create(BOOK_INPUT, REQUEST_CONTEXT);
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('no reintenta más de una vez', async () => {
      const error = uniqueViolation('Author', 'authors');
      repository.create.mockRejectedValue(error);

      await expect(service.create(BOOK_INPUT, REQUEST_CONTEXT)).rejects.toBe(
        error,
      );
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('no reintenta un P2002 de otra tabla ni otros errores', async () => {
      const other = uniqueViolation('User', 'users');
      repository.create.mockRejectedValueOnce(other);
      await expect(service.create(BOOK_INPUT, REQUEST_CONTEXT)).rejects.toBe(
        other,
      );

      repository.create.mockRejectedValueOnce(new Error('db caída'));
      await expect(service.create(BOOK_INPUT, REQUEST_CONTEXT)).rejects.toThrow(
        'db caída',
      );
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
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
      expect(repository.lockIfUnchanged).toHaveBeenCalledWith(
        tx,
        BOOK_ID,
        before.updatedAt,
        expect.any(Date),
      );
      expect(repository.update).toHaveBeenCalledWith(
        tx,
        BOOK_ID,
        { stock: 10 },
        repository.lockIfUnchanged.mock.calls[0][3],
      );
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

    it('responde 404 (no 412) si el libro no existe aunque venga If-Match', async () => {
      repository.findActiveById.mockResolvedValue(null);
      await expect(
        service.update(
          BOOK_ID,
          { stock: 1 },
          REQUEST_CONTEXT,
          parseIfMatch('"2026-01-01T00:00:00.000Z"'),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('con If-Match igual al updatedAt actual actualiza', async () => {
      repository.findActiveById.mockResolvedValue(makeBook());
      repository.update.mockResolvedValue(makeBook({ stock: 10 }));

      const result = await service.update(
        BOOK_ID,
        { stock: 10 },
        REQUEST_CONTEXT,
        parseIfMatch('"2026-09-02T10:00:00.000Z"'),
      );

      expect(result.stock).toBe(10);
      expect(audit.record).toHaveBeenCalledOnce();
    });

    it('con If-Match distinto responde 412 con el mensaje de conflicto, sin escribir ni auditar', async () => {
      repository.findActiveById.mockResolvedValue(makeBook());

      const promise = service.update(
        BOOK_ID,
        { stock: 10 },
        REQUEST_CONTEXT,
        parseIfMatch('"2026-09-01T10:00:00.000Z"'),
      );

      await expect(promise).rejects.toThrow(PreconditionFailedException);
      await expect(promise).rejects.toThrow(BOOK_MODIFIED);
      expect(BOOK_MODIFIED).toBe(
        'El libro fue modificado por otra persona. Recarga para ver la versión actual.',
      );
      expect(repository.lockIfUnchanged).not.toHaveBeenCalled();
      expect(repository.update).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('sin cambios efectivos devuelve el libro actual sin escribir ni auditar', async () => {
      repository.findActiveById.mockResolvedValue(makeBook());

      const result = await service.update(
        BOOK_ID,
        { title: 'La casa de los espíritus', price: 15990.5, stock: 3 },
        REQUEST_CONTEXT,
      );

      expect(result).toEqual(toBookDto(makeBook()));
      expect(repository.lockIfUnchanged).not.toHaveBeenCalled();
      expect(repository.update).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('la nueva versión es posterior a la anterior aunque el reloj no avance', async () => {
      const current = makeBook();
      vi.useFakeTimers({ now: current.updatedAt });
      try {
        repository.findActiveById.mockResolvedValue(current);
        repository.update.mockResolvedValue(makeBook({ stock: 10 }));

        await service.update(BOOK_ID, { stock: 10 }, REQUEST_CONTEXT);

        expect(repository.lockIfUnchanged.mock.calls[0][3]).toEqual(
          new Date(current.updatedAt.getTime() + 1),
        );
      } finally {
        vi.useRealTimers();
      }
    });

    describe('si otra transacción modificó el libro entre la lectura y la escritura', () => {
      const v1 = makeBook();
      const v2 = makeBook({
        stock: 7,
        updatedAt: new Date('2026-09-03T10:00:00.000Z'),
      });

      beforeEach(() => {
        repository.findActiveById
          .mockResolvedValueOnce(v1)
          .mockResolvedValueOnce(v2);
        repository.lockIfUnchanged
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce(true);
        repository.update.mockResolvedValue(makeBook({ stock: 10 }));
      });

      it('con If-Match de la versión leída responde 412', async () => {
        await expect(
          service.update(
            BOOK_ID,
            { stock: 10 },
            REQUEST_CONTEXT,
            parseIfMatch(`"${v1.updatedAt.toISOString()}"`),
          ),
        ).rejects.toThrow(PreconditionFailedException);
        expect(repository.update).not.toHaveBeenCalled();
        expect(audit.record).not.toHaveBeenCalled();
      });

      it('sin If-Match relee y gana la última escritura, auditando la versión vigente', async () => {
        await service.update(BOOK_ID, { stock: 10 }, REQUEST_CONTEXT);

        expect(repository.lockIfUnchanged).toHaveBeenLastCalledWith(
          tx,
          BOOK_ID,
          v2.updatedAt,
          expect.any(Date),
        );
        expect(audit.record).toHaveBeenCalledWith(
          tx,
          expect.objectContaining({
            changes: {
              before: toBookDto(v2),
              after: toBookDto(makeBook({ stock: 10 })),
            },
          }),
        );
      });
    });

    it('responde 409 si el libro cambia en cada intento', async () => {
      repository.findActiveById.mockResolvedValue(makeBook());
      repository.lockIfUnchanged.mockResolvedValue(false);

      await expect(
        service.update(BOOK_ID, { stock: 10 }, REQUEST_CONTEXT),
      ).rejects.toThrow(ConflictException);
      expect(repository.lockIfUnchanged).toHaveBeenCalledTimes(3);
      expect(repository.update).not.toHaveBeenCalled();
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

  describe('setImage', () => {
    const file = {
      buffer: JPEG_BYTES,
      mimetype: 'image/jpeg',
      size: JPEG_BYTES.length,
      originalname: 'a.jpg',
    };

    it('guarda la imagen, actualiza imageKey y audita con el mismo tx', async () => {
      repository.findActiveById.mockResolvedValue(makeBook({ imageKey: null }));
      storage.save.mockResolvedValue('new.jpg');
      repository.setImageKey.mockResolvedValue(
        makeBook({ imageKey: 'new.jpg' }),
      );

      const result = await service.setImage(BOOK_ID, file, REQUEST_CONTEXT);

      expect(storage.save).toHaveBeenCalledWith(JPEG_BYTES, 'jpg');
      expect(repository.setImageKey).toHaveBeenCalledWith(
        tx,
        BOOK_ID,
        'new.jpg',
      );
      expect(audit.record).toHaveBeenCalledWith(tx, {
        action: 'UPDATE',
        entity: 'Book',
        entityId: BOOK_ID,
        context: REQUEST_CONTEXT,
        changes: { before: { imageKey: null }, after: { imageKey: 'new.jpg' } },
      });
      expect(result.imageUrl).toBe('/api/uploads/new.jpg');
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('elimina la imagen anterior después de reemplazarla', async () => {
      repository.findActiveById.mockResolvedValue(
        makeBook({ imageKey: 'old.jpg' }),
      );
      storage.save.mockResolvedValue('new.jpg');
      repository.setImageKey.mockResolvedValue(
        makeBook({ imageKey: 'new.jpg' }),
      );

      await service.setImage(BOOK_ID, file, REQUEST_CONTEXT);

      expect(storage.delete).toHaveBeenCalledWith('old.jpg');
    });

    it('rechaza con 400 un archivo que no es JPEG/PNG/WebP (aunque diga image/jpeg)', async () => {
      await expect(
        service.setImage(
          BOOK_ID,
          { ...file, buffer: Buffer.from('GIF89a') },
          REQUEST_CONTEXT,
        ),
      ).rejects.toThrow('Formato de imagen no permitido: usa JPEG, PNG o WebP');
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('responde 404 sin guardar archivo si el libro no existe', async () => {
      repository.findActiveById.mockResolvedValue(null);
      await expect(
        service.setImage(BOOK_ID, file, REQUEST_CONTEXT),
      ).rejects.toThrow(NotFoundException);
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('borra el archivo nuevo si la transacción falla', async () => {
      repository.findActiveById.mockResolvedValue(makeBook());
      storage.save.mockResolvedValue('new.jpg');
      repository.setImageKey.mockRejectedValue(new Error('fallo'));

      await expect(
        service.setImage(BOOK_ID, file, REQUEST_CONTEXT),
      ).rejects.toThrow('fallo');
      expect(storage.delete).toHaveBeenCalledWith('new.jpg');
    });

    it('vuelve a verificar el libro activo dentro de la transacción', async () => {
      repository.findActiveById.mockResolvedValue(makeBook({ imageKey: null }));
      storage.save.mockResolvedValue('new.jpg');
      repository.setImageKey.mockResolvedValue(
        makeBook({ imageKey: 'new.jpg' }),
      );

      await service.setImage(BOOK_ID, file, REQUEST_CONTEXT);

      expect(repository.findActiveById).toHaveBeenCalledWith(BOOK_ID, tx);
    });

    it('si el libro se eliminó antes de la transacción responde 404, borra el archivo nuevo y no audita', async () => {
      repository.findActiveById
        .mockResolvedValueOnce(makeBook({ imageKey: 'old.jpg' }))
        .mockResolvedValueOnce(null);
      storage.save.mockResolvedValue('new.jpg');

      await expect(
        service.setImage(BOOK_ID, file, REQUEST_CONTEXT),
      ).rejects.toThrow(NotFoundException);

      expect(repository.setImageKey).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
      expect(storage.delete).toHaveBeenCalledExactlyOnceWith('new.jpg');
    });

    it('audita y borra, tras el commit, la imagen vigente leída dentro de la transacción', async () => {
      const order: string[] = [];
      prisma.$transaction.mockImplementation((async (
        fn: (client: typeof tx) => unknown,
      ) => {
        const result = await fn(tx);
        order.push('commit');
        return result;
      }) as never);
      repository.findActiveById
        .mockResolvedValueOnce(makeBook({ imageKey: 'stale.jpg' }))
        .mockResolvedValueOnce(makeBook({ imageKey: 'current.jpg' }));
      storage.save.mockResolvedValue('new.jpg');
      storage.delete.mockImplementation(async (key) => {
        order.push(`delete:${key}`);
      });
      repository.setImageKey.mockResolvedValue(
        makeBook({ imageKey: 'new.jpg' }),
      );

      await service.setImage(BOOK_ID, file, REQUEST_CONTEXT);

      expect(audit.record).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          changes: {
            before: { imageKey: 'current.jpg' },
            after: { imageKey: 'new.jpg' },
          },
        }),
      );
      expect(order).toEqual(['commit', 'delete:current.jpg']);
    });

    it('no falla si no puede borrar la imagen anterior', async () => {
      repository.findActiveById.mockResolvedValue(
        makeBook({ imageKey: 'old.jpg' }),
      );
      storage.save.mockResolvedValue('new.jpg');
      repository.setImageKey.mockResolvedValue(
        makeBook({ imageKey: 'new.jpg' }),
      );
      storage.delete.mockRejectedValue(new Error('EACCES'));
      const warn = vi
        .spyOn(
          (service as unknown as { logger: { warn: () => void } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      await expect(
        service.setImage(BOOK_ID, file, REQUEST_CONTEXT),
      ).resolves.toBeDefined();
      expect(warn).toHaveBeenCalledOnce();
    });
  });
});
