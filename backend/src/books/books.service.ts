import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PreconditionFailedException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { matchesIfMatch, type IfMatchCondition } from '../common/http/etag.js';
import {
  buildPaginationMeta,
  PaginatedResult,
  toSkipTake,
} from '../common/pagination/pagination.js';
import type { RequestContext } from '../common/types/request-context.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DbClient } from '../prisma/prisma.types.js';
import { detectImageType } from '../storage/image-type.js';
import {
  STORAGE_SERVICE,
  type StorageService,
  type UploadedImage,
} from '../storage/storage.service.js';
import { hasEffectiveChanges } from './book-changes.js';
import { buildBookQuery } from './book-query.js';
import {
  toBookDto,
  toTrashedBookDto,
  type BookDto,
  type TrashedBookDto,
} from './book.mapper.js';
import { BooksRepository, type BookInput } from './books.repository.js';
import { isCatalogNameConflict } from './catalog-conflict.js';
import type { BookListQueryDto } from './dto/book-list-query.dto.js';
import type { TrashQueryDto } from './dto/trash-query.dto.js';

export const BOOK_NOT_FOUND = 'Libro no encontrado';
export const BOOK_MODIFIED =
  'El libro fue modificado por otra persona. Recarga para ver la versión actual.';
export const BOOK_BUSY =
  'El libro se está modificando en este momento; intenta nuevamente.';

/** Relecturas ante escrituras concurrentes antes de responder 409. */
const MAX_UPDATE_ATTEMPTS = 3;

/** Versión siguiente: estrictamente posterior a la actual aunque el reloj no avance. */
function nextVersion(current: Date): Date {
  return new Date(Math.max(Date.now(), current.getTime() + 1));
}

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: BooksRepository,
    private readonly audit: AuditService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  async list(query: BookListQueryDto): Promise<PaginatedResult<BookDto>> {
    const { where, orderBy } = buildBookQuery(query);
    const [books, total] = await this.repository.findPage({
      where,
      orderBy,
      ...toSkipTake(query.page, query.limit),
    });
    return new PaginatedResult(
      books.map(toBookDto),
      buildPaginationMeta(query.page, query.limit, total),
    );
  }

  async listTrash(
    query: TrashQueryDto,
  ): Promise<PaginatedResult<TrashedBookDto>> {
    const [books, total] = await this.repository.findTrashPage({
      search: query.search,
      ...toSkipTake(query.page, query.limit),
    });
    return new PaginatedResult(
      books.map(toTrashedBookDto),
      buildPaginationMeta(query.page, query.limit, total),
    );
  }

  async findOne(id: string): Promise<BookDto> {
    const book = await this.repository.findActiveById(id);
    if (!book) {
      throw new NotFoundException(BOOK_NOT_FOUND);
    }
    return toBookDto(book);
  }

  create(input: BookInput, context: RequestContext): Promise<BookDto> {
    return this.retryOnCatalogRace(() =>
      this.prisma.$transaction(async (tx) => {
        const book = toBookDto(await this.repository.create(tx, input));
        await this.audit.record(tx, {
          action: 'CREATE',
          entity: 'Book',
          entityId: book.id,
          context,
          changes: { after: book },
        });
        return book;
      }),
    );
  }

  /**
   * Edición parcial con bloqueo optimista opcional: con `If-Match` distinto del
   * `updatedAt` vigente responde 412; sin él gana la última escritura. Un PATCH sin
   * cambios efectivos devuelve el libro sin tocar `updatedAt` ni auditar.
   */
  update(
    id: string,
    input: Partial<BookInput>,
    context: RequestContext,
    ifMatch?: IfMatchCondition,
  ): Promise<BookDto> {
    if (Object.values(input).every((value) => value === undefined)) {
      throw new BadRequestException(
        'Debes enviar al menos un campo para actualizar',
      );
    }
    return this.retryOnCatalogRace(() =>
      this.prisma.$transaction((tx) =>
        this.updateInTransaction(tx, id, input, context, ifMatch),
      ),
    );
  }

  private async updateInTransaction(
    tx: DbClient,
    id: string,
    input: Partial<BookInput>,
    context: RequestContext,
    ifMatch: IfMatchCondition | undefined,
  ): Promise<BookDto> {
    for (let attempt = 1; attempt <= MAX_UPDATE_ATTEMPTS; attempt++) {
      const current = await this.repository.findActiveById(id, tx);
      if (!current) {
        throw new NotFoundException(BOOK_NOT_FOUND);
      }
      if (!matchesIfMatch(ifMatch, current.updatedAt)) {
        throw new PreconditionFailedException(BOOK_MODIFIED);
      }
      if (!hasEffectiveChanges(current, input)) {
        return toBookDto(current);
      }
      const version = nextVersion(current.updatedAt);
      // Falla si otra transacción cambió el libro tras la lectura: se relee y se
      // vuelve a evaluar (con If-Match, la versión ya no coincide → 412).
      if (
        await this.repository.lockIfUnchanged(
          tx,
          id,
          current.updatedAt,
          version,
        )
      ) {
        const updated = toBookDto(
          await this.repository.update(tx, id, input, version),
        );
        await this.audit.record(tx, {
          action: 'UPDATE',
          entity: 'Book',
          entityId: id,
          context,
          changes: { before: toBookDto(current), after: updated },
        });
        return updated;
      }
    }
    throw new ConflictException(BOOK_BUSY);
  }

  async remove(id: string, context: RequestContext): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await this.repository.findActiveById(id, tx);
      if (!current) {
        throw new NotFoundException(BOOK_NOT_FOUND);
      }
      await this.repository.softDelete(tx, id);
      await this.audit.record(tx, {
        action: 'DELETE',
        entity: 'Book',
        entityId: id,
        context,
        changes: { before: toBookDto(current) },
      });
    });
  }

  restore(id: string, context: RequestContext): Promise<BookDto> {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.repository.findAnyById(id, tx);
      if (!current) {
        throw new NotFoundException(BOOK_NOT_FOUND);
      }
      if (current.deletedAt === null) {
        return toBookDto(current);
      }
      const restored = toBookDto(await this.repository.restore(tx, id));
      await this.audit.record(tx, {
        action: 'RESTORE',
        entity: 'Book',
        entityId: id,
        context,
        changes: { after: restored },
      });
      return restored;
    });
  }

  /**
   * Sube o reemplaza la imagen con el mismo bloqueo optimista que `update`: con
   * `If-Match` distinto del `updatedAt` vigente responde 412 sin conservar el archivo
   * nuevo ni borrar el anterior. Cambiar la imagen crea una versión nueva del libro.
   */
  async setImage(
    id: string,
    file: UploadedImage,
    context: RequestContext,
    ifMatch?: IfMatchCondition,
  ): Promise<BookDto> {
    const extension = detectImageType(file.buffer);
    if (!extension) {
      throw new BadRequestException(
        'Formato de imagen no permitido: usa JPEG, PNG o WebP',
      );
    }
    // Chequeo previo para no escribir archivos de libros inexistentes o ya modificados.
    const existing = await this.repository.findActiveById(id);
    if (!existing) {
      throw new NotFoundException(BOOK_NOT_FOUND);
    }
    if (!matchesIfMatch(ifMatch, existing.updatedAt)) {
      throw new PreconditionFailedException(BOOK_MODIFIED);
    }

    const key = await this.storage.save(file.buffer, extension);
    let result: { book: BookDto; previousKey: string | null };
    try {
      result = await this.prisma.$transaction((tx) =>
        this.setImageInTransaction(tx, id, key, context, ifMatch),
      );
    } catch (error) {
      await this.deleteQuietly(key);
      throw error;
    }

    // La imagen anterior se borra solo después del commit.
    if (result.previousKey) {
      await this.deleteQuietly(result.previousKey);
    }
    return result.book;
  }

  private async setImageInTransaction(
    tx: DbClient,
    id: string,
    key: string,
    context: RequestContext,
    ifMatch: IfMatchCondition | undefined,
  ): Promise<{ book: BookDto; previousKey: string | null }> {
    for (let attempt = 1; attempt <= MAX_UPDATE_ATTEMPTS; attempt++) {
      // Se repite dentro de la transacción: el libro pudo eliminarse, cambiar de imagen
      // o de versión desde el chequeo previo.
      const current = await this.repository.findActiveById(id, tx);
      if (!current) {
        throw new NotFoundException(BOOK_NOT_FOUND);
      }
      if (!matchesIfMatch(ifMatch, current.updatedAt)) {
        throw new PreconditionFailedException(BOOK_MODIFIED);
      }
      const version = nextVersion(current.updatedAt);
      if (
        await this.repository.lockIfUnchanged(
          tx,
          id,
          current.updatedAt,
          version,
        )
      ) {
        const book = toBookDto(
          await this.repository.setImageKey(tx, id, key, version),
        );
        await this.audit.record(tx, {
          action: 'UPDATE',
          entity: 'Book',
          entityId: id,
          context,
          changes: {
            before: { imageKey: current.imageKey },
            after: { imageKey: key },
          },
        });
        return { book, previousKey: current.imageKey };
      }
    }
    throw new ConflictException(BOOK_BUSY);
  }

  /**
   * Si otra transacción creó a la vez el mismo autor, editorial o género, se repite la
   * transacción completa una vez: en el segundo intento la búsqueda por nombre lo encuentra.
   */
  private async retryOnCatalogRace<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (!isCatalogNameConflict(error)) {
        throw error;
      }
      this.logger.debug('Nombre de catálogo creado en paralelo: se reintenta');
      return run();
    }
  }

  private async deleteQuietly(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (error) {
      this.logger.warn(
        `No se pudo eliminar la imagen ${key}: ${String(error)}`,
      );
    }
  }
}
