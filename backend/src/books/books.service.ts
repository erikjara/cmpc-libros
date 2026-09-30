import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import {
  buildPaginationMeta,
  PaginatedResult,
  toSkipTake,
} from '../common/pagination/pagination.js';
import type { RequestContext } from '../common/types/request-context.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { detectImageType } from '../storage/image-type.js';
import {
  STORAGE_SERVICE,
  type StorageService,
  type UploadedImage,
} from '../storage/storage.service.js';
import { buildBookQuery } from './book-query.js';
import { toBookDto, type BookDto } from './book.mapper.js';
import { BooksRepository, type BookInput } from './books.repository.js';
import type { BookListQueryDto } from './dto/book-list-query.dto.js';

export const BOOK_NOT_FOUND = 'Libro no encontrado';

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

  async findOne(id: string): Promise<BookDto> {
    const book = await this.repository.findActiveById(id);
    if (!book) {
      throw new NotFoundException(BOOK_NOT_FOUND);
    }
    return toBookDto(book);
  }

  create(input: BookInput, context: RequestContext): Promise<BookDto> {
    return this.prisma.$transaction(async (tx) => {
      const book = toBookDto(await this.repository.create(tx, input));
      await this.audit.record(tx, {
        action: 'CREATE',
        entity: 'Book',
        entityId: book.id,
        context,
        changes: { after: book },
      });
      return book;
    });
  }

  update(
    id: string,
    input: Partial<BookInput>,
    context: RequestContext,
  ): Promise<BookDto> {
    if (Object.values(input).every((value) => value === undefined)) {
      throw new BadRequestException(
        'Debes enviar al menos un campo para actualizar',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const current = await this.repository.findActiveById(id, tx);
      if (!current) {
        throw new NotFoundException(BOOK_NOT_FOUND);
      }
      const updated = toBookDto(await this.repository.update(tx, id, input));
      await this.audit.record(tx, {
        action: 'UPDATE',
        entity: 'Book',
        entityId: id,
        context,
        changes: { before: toBookDto(current), after: updated },
      });
      return updated;
    });
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

  async setImage(
    id: string,
    file: UploadedImage,
    context: RequestContext,
  ): Promise<BookDto> {
    const extension = detectImageType(file.buffer);
    if (!extension) {
      throw new BadRequestException(
        'Formato de imagen no permitido: usa JPEG, PNG o WebP',
      );
    }
    // Chequeo previo para no escribir archivos de libros inexistentes.
    if (!(await this.repository.findActiveById(id))) {
      throw new NotFoundException(BOOK_NOT_FOUND);
    }

    const key = await this.storage.save(file.buffer, extension);
    let result: { book: BookDto; previousKey: string | null };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        // Se repite dentro de la transacción: el libro pudo eliminarse o cambiar de imagen.
        const current = await this.repository.findActiveById(id, tx);
        if (!current) {
          throw new NotFoundException(BOOK_NOT_FOUND);
        }
        const book = toBookDto(await this.repository.setImageKey(tx, id, key));
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
      });
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
