import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';
import { formatETag } from '../http/etag.js';

function readUpdatedAt(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { updatedAt } = value as { updatedAt?: unknown };
  return typeof updatedAt === 'string' ? updatedAt : undefined;
}

/** `updatedAt` del recurso devuelto por el handler o ya envuelto en `{ data }`. */
export function extractUpdatedAt(body: unknown): string | undefined {
  return (
    readUpdatedAt(body) ??
    readUpdatedAt((body as { data?: unknown } | null | undefined)?.data)
  );
}

/** Agrega `ETag: "<updatedAt>"` para que el cliente pueda editar con `If-Match`. */
@Injectable()
export class ETagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      tap((body) => {
        const updatedAt = extractUpdatedAt(body);
        if (updatedAt) {
          response.setHeader('ETag', formatETag(updatedAt));
        }
      }),
    );
  }
}
