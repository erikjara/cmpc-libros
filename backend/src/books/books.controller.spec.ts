import { EventEmitter } from 'node:events';
import { PassThrough, Readable } from 'node:stream';
import { BadRequestException, Logger, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { INTERCEPTORS_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { ETagInterceptor } from '../common/interceptors/etag.interceptor.js';
import { NO_TIMEOUT_KEY } from '../common/decorators/no-timeout.decorator.js';
import { PaginatedResult } from '../common/pagination/pagination.js';
import {
  BOOK_ID,
  BOOK_INPUT,
  makeBook,
  REQUEST_CONTEXT,
} from '../testing/book-fixtures.js';
import { JPEG_BYTES } from '../testing/image-fixtures.js';
import { toBookDto } from './book.mapper.js';
import type { BooksExportService } from './books-export.service.js';
import { BooksController } from './books.controller.js';
import type { BooksService } from './books.service.js';
import type { BookListQueryDto } from './dto/book-list-query.dto.js';

function fakeResponse(destroyed = false) {
  const response = Object.assign(new EventEmitter(), {
    destroyed,
    headersSent: true,
    statusCode: 200,
    destroy: vi.fn(),
    send: vi.fn(),
    end: vi.fn(),
  });
  return response as typeof response & Response;
}

describe('BooksController', () => {
  let books: MockProxy<BooksService>;
  let exporter: MockProxy<BooksExportService>;
  let controller: BooksController;
  const dto = toBookDto(makeBook());

  beforeEach(() => {
    books = mock<BooksService>();
    exporter = mock<BooksExportService>();
    controller = new BooksController(books, exporter);
  });

  it('excluye del límite de tiempo solo la exportación y la subida de imagen', () => {
    const reflector = new Reflector();
    const prototype = BooksController.prototype as unknown as Record<
      string,
      () => unknown
    >;
    const exempt = Object.getOwnPropertyNames(prototype).filter(
      (name) =>
        name !== 'constructor' &&
        reflector.get<boolean>(NO_TIMEOUT_KEY, prototype[name]),
    );
    expect(exempt.sort()).toEqual(['export', 'uploadImage']);
  });

  it('update interpreta el header If-Match y lo pasa al service', async () => {
    books.update.mockResolvedValue(dto);
    await controller.update(
      BOOK_ID,
      { stock: 2 },
      REQUEST_CONTEXT,
      '"2026-09-30T23:58:12.345Z"',
    );
    expect(books.update).toHaveBeenCalledWith(
      BOOK_ID,
      { stock: 2 },
      REQUEST_CONTEXT,
      { any: false, tags: ['2026-09-30T23:58:12.345Z'] },
    );
  });

  it('agrega ETag a detalle, alta, edición, restauración e imagen', () => {
    const prototype = BooksController.prototype as unknown as Record<
      string,
      () => unknown
    >;
    const withETag = Object.getOwnPropertyNames(prototype).filter((name) =>
      (
        (Reflect.getMetadata(INTERCEPTORS_METADATA, prototype[name]) ??
          []) as unknown[]
      ).includes(ETagInterceptor),
    );
    expect(withETag.sort()).toEqual([
      'create',
      'findOne',
      'restore',
      'update',
      'uploadImage',
    ]);
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
    await controller.update(BOOK_ID, { stock: 2 }, REQUEST_CONTEXT, undefined);
    await controller.remove(BOOK_ID, REQUEST_CONTEXT);
    await controller.restore(BOOK_ID, REQUEST_CONTEXT);

    expect(books.findOne).toHaveBeenCalledWith(BOOK_ID);
    expect(books.create).toHaveBeenCalledWith(BOOK_INPUT, REQUEST_CONTEXT);
    expect(books.update).toHaveBeenCalledWith(
      BOOK_ID,
      { stock: 2 },
      REQUEST_CONTEXT,
      undefined,
    );
    expect(books.remove).toHaveBeenCalledWith(BOOK_ID, REQUEST_CONTEXT);
    expect(books.restore).toHaveBeenCalledWith(BOOK_ID, REQUEST_CONTEXT);
  });

  it('export devuelve un StreamableFile CSV con nombre de archivo fechado', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T15:00:00.000Z'));
    exporter.createCsvStream.mockResolvedValue(Readable.from(['a']));

    const file = await controller.export(
      { genreId: 'g1' },
      REQUEST_CONTEXT,
      fakeResponse(),
    );

    expect(exporter.createCsvStream).toHaveBeenCalledWith(
      { genreId: 'g1' },
      REQUEST_CONTEXT,
    );
    expect(file).toBeInstanceOf(StreamableFile);
    expect(file.getHeaders()).toMatchObject({
      type: 'text/csv; charset=utf-8',
      disposition: 'attachment; filename="libros-2026-09-30.csv"',
    });
    vi.useRealTimers();
  });

  it('export propaga el error si el primer lote falla (lo formatea el filtro global)', async () => {
    exporter.createCsvStream.mockRejectedValue(new Error('db caída'));
    await expect(
      controller.export({}, REQUEST_CONTEXT, fakeResponse()),
    ).rejects.toThrow('db caída');
  });

  it('un fallo a mitad del stream se registra y destruye la respuesta', async () => {
    exporter.createCsvStream.mockResolvedValue(new PassThrough());
    const logError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const file = await controller.export({}, REQUEST_CONTEXT, fakeResponse());
    const response = fakeResponse();
    const error = new Error('conexión perdida');

    file.errorHandler(error, response);

    expect(response.destroy).toHaveBeenCalledWith(error);
    expect(response.send).not.toHaveBeenCalled();
    expect(response.end).not.toHaveBeenCalled();
    expect(String(logError.mock.calls[0][0])).toContain('conexión perdida');
    logError.mockRestore();
  });

  it('no destruye una respuesta ya cerrada', async () => {
    exporter.createCsvStream.mockResolvedValue(new PassThrough());
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const file = await controller.export({}, REQUEST_CONTEXT, fakeResponse());
    const response = fakeResponse(true);

    file.errorHandler(new Error('x'), response);

    expect(response.destroy).not.toHaveBeenCalled();
  });

  it('si el cliente se desconecta, destruye el stream CSV', async () => {
    const stream = new PassThrough();
    exporter.createCsvStream.mockResolvedValue(stream);
    const response = fakeResponse();

    await controller.export({}, REQUEST_CONTEXT, response);
    response.emit('close');

    expect(stream.destroyed).toBe(true);
  });

  it('no destruye el stream si ya terminó al cerrarse la respuesta', async () => {
    const stream = Readable.from(['a']);
    exporter.createCsvStream.mockResolvedValue(stream);
    const response = fakeResponse();

    await controller.export({}, REQUEST_CONTEXT, response);
    for await (const chunk of stream) {
      expect(chunk).toBe('a');
    }
    const destroy = vi.spyOn(stream, 'destroy');
    response.emit('close');

    expect(destroy).not.toHaveBeenCalled();
  });

  it('uploadImage exige el archivo', () => {
    expect(() =>
      controller.uploadImage(BOOK_ID, undefined, REQUEST_CONTEXT),
    ).toThrow(BadRequestException);
  });

  it('uploadImage delega el archivo al service', async () => {
    const file = {
      buffer: JPEG_BYTES,
      mimetype: 'image/jpeg',
      size: 6,
      originalname: 'a.jpg',
    };
    books.setImage.mockResolvedValue(dto);
    await controller.uploadImage(BOOK_ID, file, REQUEST_CONTEXT);
    expect(books.setImage).toHaveBeenCalledWith(BOOK_ID, file, REQUEST_CONTEXT);
  });
});
