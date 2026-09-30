import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';
import {
  REQUEST_ID_HEADER,
  resolveRequestId,
} from '../logging/logger.options.js';
import {
  defaultMessage,
  INTERNAL_ERROR_MESSAGE,
  statusText,
  translateMessage,
} from './error-messages.js';

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
  requestId: string;
}

interface ResolvedError {
  statusCode: number;
  message: string | string[];
}

/** Errores de http-errors que Express/body-parser lanzan antes de Nest (p. ej. 413). */
interface ExpressHttpError {
  status: number;
  expose: boolean;
}

function isExpressHttpError(exception: unknown): exception is ExpressHttpError {
  if (typeof exception !== 'object' || exception === null) {
    return false;
  }
  const candidate = exception as Partial<ExpressHttpError>;
  return (
    typeof candidate.status === 'number' &&
    candidate.status >= 400 &&
    candidate.status < 500 &&
    candidate.expose === true
  );
}

function extractHttpMessage(
  exception: HttpException,
): string | string[] | undefined {
  const response = exception.getResponse();
  if (typeof response === 'string') {
    return response;
  }
  if (
    typeof response === 'object' &&
    response !== null &&
    'message' in response
  ) {
    const { message } = response as { message: unknown };
    if (typeof message === 'string') {
      return message;
    }
    if (
      Array.isArray(message) &&
      message.every((item) => typeof item === 'string')
    ) {
      return message;
    }
  }
  return undefined;
}

export function resolveError(exception: unknown): ResolvedError {
  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus();
    if (statusCode === 500) {
      return { statusCode, message: INTERNAL_ERROR_MESSAGE };
    }
    return {
      statusCode,
      message: translateMessage(statusCode, extractHttpMessage(exception)),
    };
  }
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    if (exception.code === 'P2025') {
      return { statusCode: 404, message: 'Recurso no encontrado' };
    }
    if (exception.code === 'P2002') {
      return { statusCode: 409, message: 'El recurso ya existe' };
    }
  }
  if (isExpressHttpError(exception)) {
    return {
      statusCode: exception.status,
      message: defaultMessage(exception.status),
    };
  }
  return { statusCode: 500, message: INTERNAL_ERROR_MESSAGE };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request & { id?: string | number }>();
    const response = http.getResponse<Response>();
    const { statusCode, message } = resolveError(exception);

    if (statusCode >= 500) {
      this.logger.error(
        exception instanceof Error
          ? (exception.stack ?? exception.message)
          : String(exception),
      );
    }

    // Errores previos a pino-http (JSON malformado) no tienen req.id: se genera aquí.
    const requestId =
      request.id === undefined
        ? resolveRequestId(request.headers?.[REQUEST_ID_HEADER])
        : String(request.id);
    if (!response.headersSent && !response.getHeader('X-Request-Id')) {
      response.setHeader('X-Request-Id', requestId);
    }

    const body: ApiErrorBody = {
      statusCode,
      error: statusText(statusCode),
      message,
      path: request.originalUrl ?? request.url,
      timestamp: new Date().toISOString(),
      requestId,
    };
    response.status(statusCode).json(body);
  }
}
