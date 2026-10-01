import {
  CallHandler,
  ExecutionContext,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, NEVER, of, throwError, timer, map } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../../config/env.schema.js';
import { NoTimeout } from '../decorators/no-timeout.decorator.js';
import { resolveError } from '../filters/all-exceptions.filter.js';
import {
  REQUEST_TIMEOUT_MESSAGE,
  TimeoutInterceptor,
} from './timeout.interceptor.js';

class SampleController {
  regular(): void {}

  @NoTimeout()
  streaming(): void {}
}

@NoTimeout()
class NoTimeoutController {
  any(): void {}
}

function contextFor(
  controller: new () => object,
  handler: string,
): ExecutionContext {
  return {
    getClass: () => controller,
    getHandler: () =>
      (controller.prototype as Record<string, () => void>)[handler],
  } as unknown as ExecutionContext;
}

function config(timeoutMs: number): ConfigService<Env, true> {
  return {
    get: (key: string) =>
      key === 'REQUEST_TIMEOUT_MS' ? timeoutMs : undefined,
  } as unknown as ConfigService<Env, true>;
}

describe('TimeoutInterceptor', () => {
  let interceptor: TimeoutInterceptor;

  beforeEach(() => {
    vi.useFakeTimers();
    interceptor = new TimeoutInterceptor(new Reflector(), config(1000));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deja pasar la respuesta si llega antes del límite', async () => {
    const next: CallHandler = {
      handle: () => timer(999).pipe(map(() => 'ok')),
    };
    const result = lastValueFrom(
      interceptor.intercept(contextFor(SampleController, 'regular'), next),
    );
    await vi.advanceTimersByTimeAsync(999);
    await expect(result).resolves.toBe('ok');
  });

  it('responde 503 "La solicitud tardó demasiado" al superar REQUEST_TIMEOUT_MS', async () => {
    const next: CallHandler = { handle: () => NEVER };
    const result = lastValueFrom(
      interceptor.intercept(contextFor(SampleController, 'regular'), next),
    );
    const assertion = expect(result).rejects.toThrow(
      ServiceUnavailableException,
    );
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    await expect(result).rejects.toThrow(REQUEST_TIMEOUT_MESSAGE);
  });

  it('el filtro global lo traduce a 503 con el mensaje en español', () => {
    expect(
      resolveError(new ServiceUnavailableException(REQUEST_TIMEOUT_MESSAGE)),
    ).toEqual({ statusCode: 503, message: 'La solicitud tardó demasiado' });
  });

  it('propaga sin cambios otros errores del handler', async () => {
    const error = new Error('fallo');
    const next: CallHandler = { handle: () => throwError(() => error) };
    await expect(
      lastValueFrom(
        interceptor.intercept(contextFor(SampleController, 'regular'), next),
      ),
    ).rejects.toBe(error);
  });

  it.each([
    [SampleController, 'streaming'],
    [NoTimeoutController, 'any'],
  ] as const)(
    'no aplica límite a handlers o controllers con @NoTimeout() (%o)',
    async (controller, handler) => {
      const source = of('archivo');
      const next: CallHandler = { handle: () => source };
      expect(interceptor.intercept(contextFor(controller, handler), next)).toBe(
        source,
      );
    },
  );

  it('lee REQUEST_TIMEOUT_MS de la configuración', async () => {
    interceptor = new TimeoutInterceptor(new Reflector(), config(50));
    const next: CallHandler = { handle: () => NEVER };
    const result = lastValueFrom(
      interceptor.intercept(contextFor(SampleController, 'regular'), next),
    );
    const assertion = expect(result).rejects.toThrow(REQUEST_TIMEOUT_MESSAGE);
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
  });
});
