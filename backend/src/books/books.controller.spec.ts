import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { PaginatedResult } from '../common/pagination/pagination.js';
import {
  BOOK_ID,
  BOOK_INPUT,
  makeBook,
  REQUEST_CONTEXT,
} from '../testing/book-fixtures.js';
import { toBookDto } from './book.mapper.js';
import { BooksController } from './books.controller.js';
import type { BooksService } from './books.service.js';
import type { BookListQueryDto } from './dto/book-list-query.dto.js';

describe('BooksController', () => {
  let books: MockProxy<BooksService>;
  let controller: BooksController;
  const dto = toBookDto(makeBook());

  beforeEach(() => {
    books = mock<BooksService>();
    controller = new BooksController(books);
  });

  it('list delega la query al service', async () => {
    const page = new PaginatedResult([dto], {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
    books.list.mockResolvedValue(page);
    const query = { page: 1, limit: 10 } as BookListQueryDto;
    await expect(controller.list(query)).resolves.toBe(page);
    expect(books.list).toHaveBeenCalledWith(query);
  });

  it('findOne, create, update, remove y restore pasan id, body y contexto', async () => {
    books.findOne.mockResolvedValue(dto);
    books.create.mockResolvedValue(dto);
    books.update.mockResolvedValue(dto);
    books.remove.mockResolvedValue();
    books.restore.mockResolvedValue(dto);

    await controller.findOne(BOOK_ID);
    await controller.create(BOOK_INPUT, REQUEST_CONTEXT);
    await controller.update(BOOK_ID, { stock: 2 }, REQUEST_CONTEXT);
    await controller.remove(BOOK_ID, REQUEST_CONTEXT);
    await controller.restore(BOOK_ID, REQUEST_CONTEXT);

    expect(books.findOne).toHaveBeenCalledWith(BOOK_ID);
    expect(books.create).toHaveBeenCalledWith(BOOK_INPUT, REQUEST_CONTEXT);
    expect(books.update).toHaveBeenCalledWith(
      BOOK_ID,
      { stock: 2 },
      REQUEST_CONTEXT,
    );
    expect(books.remove).toHaveBeenCalledWith(BOOK_ID, REQUEST_CONTEXT);
    expect(books.restore).toHaveBeenCalledWith(BOOK_ID, REQUEST_CONTEXT);
  });
});
