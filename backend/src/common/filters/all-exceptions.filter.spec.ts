import {
  ArgumentsHost,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { AllExceptionsFilter, resolveError } from './all-exceptions.filter.js';

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('boom', {
    code,
    clientVersion: '7.10.0',
  });
}

function createHost(request: Record<string, unknown>) {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const setHeader = vi.fn();
  const response = {
    status,
    setHeader,
    getHeader: vi.fn(),
    headersSent: false,
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ headers: {}, ...request }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json, setHeader };
}

describe('resolveError', () => {
  it('conserva el mensaje de una HttpException propia', () => {
    expect(resolveError(new NotFoundException('Libro no encontrado'))).toEqual({
      statusCode: 404,
      message: 'Libro no encontrado',
    });
  });

  it('conserva la lista de mensajes de validación', () => {
    expect(resolveError(new BadRequestException(['a', 'b']))).toEqual({
      statusCode: 400,
      message: ['a', 'b'],
    });
  });

  it('traduce el 404 de ruta inexistente', () => {
    expect(resolveError(new NotFoundException('Cannot GET /api/nada'))).toEqual(
      {
        statusCode: 404,
        message: 'Recurso no encontrado',
      },
    );
  });

  it('traduce el 413 de multer', () => {
    expect(
      resolveError(new PayloadTooLargeException('File too large')),
    ).toEqual({
      statusCode: 413,
      message: 'La imagen supera el tamaño máximo de 2 MB',
    });
  });

  it('traduce errores de multer aunque incluyan el nombre del campo', () => {
    expect(
      resolveError(new BadRequestException('Unexpected file field - file'))
        .message,
    ).toBe('Campo de archivo inesperado: envía la imagen en el campo "image"');
    expect(
      resolveError(new BadRequestException('Multipart: Boundary not found'))
        .message,
    ).toBe('El formulario multipart es inválido');
  });

  it('traduce el JSON malformado que Nest convierte en 400', () => {
    expect(
      resolveError(new BadRequestException('Unexpected end of JSON input')),
    ).toEqual({
      statusCode: 400,
      message: 'El cuerpo de la solicitud no es un JSON válido',
    });
  });

  it('traduce el 429 del throttler', () => {
    expect(resolveError(new ThrottlerException()).statusCode).toBe(429);
    expect(resolveError(new ThrottlerException()).message).toBe(
      'Demasiadas solicitudes, intenta nuevamente en un momento',
    );
  });

  it('usa un mensaje por defecto cuando la respuesta no trae message (health 503)', () => {
    expect(
      resolveError(new ServiceUnavailableException({ status: 'error' })),
    ).toEqual({
      statusCode: 503,
      message: 'Servicio no disponible',
    });
  });

  it('nunca expone el detalle de un 500', () => {
    expect(
      resolveError(new InternalServerErrorException('detalle interno')),
    ).toEqual({
      statusCode: 500,
      message: 'Error interno del servidor',
    });
  });

  it('mapea Prisma P2025 a 404', () => {
    expect(resolveError(prismaError('P2025'))).toEqual({
      statusCode: 404,
      message: 'Recurso no encontrado',
    });
  });

  it('mapea Prisma P2002 a 409', () => {
    expect(resolveError(prismaError('P2002'))).toEqual({
      statusCode: 409,
      message: 'El recurso ya existe',
    });
  });

  it('trata otros códigos de Prisma como 500', () => {
    expect(resolveError(prismaError('P2039')).statusCode).toBe(500);
  });

  it('mapea un cuerpo JSON demasiado grande (body-parser) a 413', () => {
    const error = Object.assign(new Error('request entity too large'), {
      status: 413,
      type: 'entity.too.large',
      expose: true,
    });
    expect(resolveError(error)).toEqual({
      statusCode: 413,
      message: 'El contenido enviado supera el tamaño máximo permitido',
    });
  });

  it('trata errores desconocidos como 500 genérico', () => {
    expect(resolveError(new Error('secreto'))).toEqual({
      statusCode: 500,
      message: 'Error interno del servidor',
    });
    expect(resolveError('texto').statusCode).toBe(500);
  });
});

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('responde con el formato de error uniforme', () => {
    const { host, status, json } = createHost({
      originalUrl: '/api/books/1',
      url: '/books/1',
      id: 'req-123',
    });

    filter.catch(new NotFoundException('Libro no encontrado'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      error: 'Not Found',
      message: 'Libro no encontrado',
      path: '/api/books/1',
      timestamp: '2026-09-30T12:00:00.000Z',
      requestId: 'req-123',
    });
  });

  it('registra los errores 500 y genera requestId si pino-http aún no lo asignó', () => {
    const logSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { host, json, setHeader } = createHost({ url: '/api/x' });

    filter.catch(new Error('fallo'), host);

    expect(logSpy).toHaveBeenCalledOnce();
    const body = json.mock.calls[0][0] as { requestId: string };
    expect(body).toMatchObject({ statusCode: 500, path: '/api/x' });
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', body.requestId);
  });
});
