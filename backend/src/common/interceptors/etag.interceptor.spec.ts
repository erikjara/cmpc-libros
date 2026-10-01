import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ETagInterceptor, extractUpdatedAt } from './etag.interceptor.js';

function contextWith(response: { setHeader: (...args: unknown[]) => void }) {
  return {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ExecutionContext;
}

describe('extractUpdatedAt', () => {
  it('lee updatedAt del recurso o de { data }', () => {
    expect(extractUpdatedAt({ updatedAt: '2026-09-30T23:58:12.345Z' })).toBe(
      '2026-09-30T23:58:12.345Z',
    );
    expect(
      extractUpdatedAt({ data: { updatedAt: '2026-09-30T23:58:12.345Z' } }),
    ).toBe('2026-09-30T23:58:12.345Z');
  });

  it.each([undefined, null, 'texto', {}, { updatedAt: 1 }, { data: null }])(
    'devuelve undefined si no hay updatedAt de texto (%j)',
    (body) => {
      expect(extractUpdatedAt(body)).toBeUndefined();
    },
  );
});

describe('ETagInterceptor', () => {
  it('pone ETag: "<updatedAt>" sin modificar la respuesta', async () => {
    const response = { setHeader: vi.fn() };
    const body = { id: '1', updatedAt: '2026-09-30T23:58:12.345Z' };
    const next: CallHandler = { handle: () => of(body) };

    const result = await lastValueFrom(
      new ETagInterceptor().intercept(contextWith(response), next),
    );

    expect(result).toBe(body);
    expect(response.setHeader).toHaveBeenCalledWith(
      'ETag',
      '"2026-09-30T23:58:12.345Z"',
    );
  });

  it('no pone el header si la respuesta no tiene updatedAt', async () => {
    const response = { setHeader: vi.fn() };
    const next: CallHandler = { handle: () => of(undefined) };
    await lastValueFrom(
      new ETagInterceptor().intercept(contextWith(response), next),
      { defaultValue: undefined },
    );
    expect(response.setHeader).not.toHaveBeenCalled();
  });
});
