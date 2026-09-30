import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { PaginatedResult } from '../pagination/pagination.js';

export function wrapResponse(body: unknown): unknown {
  if (body === undefined || body instanceof StreamableFile) {
    return body;
  }
  if (body instanceof PaginatedResult) {
    return { data: body.items, meta: body.meta };
  }
  return { data: body };
}

/** Envuelve toda respuesta exitosa en `{ data, meta? }` (salvo archivos y 204). */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(map(wrapResponse));
  }
}
