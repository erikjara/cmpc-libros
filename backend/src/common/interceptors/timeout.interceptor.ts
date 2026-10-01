import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  catchError,
  Observable,
  throwError,
  timeout,
  TimeoutError,
} from 'rxjs';
import type { Env } from '../../config/env.schema.js';
import { NO_TIMEOUT_KEY } from '../decorators/no-timeout.decorator.js';

export const REQUEST_TIMEOUT_MESSAGE = 'La solicitud tardó demasiado';

/**
 * Limita el tiempo de respuesta de cada handler a `REQUEST_TIMEOUT_MS` (503 si se
 * supera). No aplica a los marcados con `@NoTimeout()` (exportación y subidas).
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly timeoutMs: number;

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService<Env, true>,
  ) {
    this.timeoutMs = config.get('REQUEST_TIMEOUT_MS', { infer: true });
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(NO_TIMEOUT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return next.handle();
    }
    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((error: unknown) =>
        throwError(() =>
          error instanceof TimeoutError
            ? new ServiceUnavailableException(REQUEST_TIMEOUT_MESSAGE)
            : error,
        ),
      ),
    );
  }
}
