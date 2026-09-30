import { CallHandler, ExecutionContext, StreamableFile } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { PaginatedResult } from '../pagination/pagination.js';
import { TransformInterceptor, wrapResponse } from './transform.interceptor.js';

describe('wrapResponse', () => {
  it('envuelve objetos en { data }', () => {
    expect(wrapResponse({ id: '1' })).toEqual({ data: { id: '1' } });
  });

  it('envuelve arreglos en { data }', () => {
    expect(wrapResponse([1, 2])).toEqual({ data: [1, 2] });
  });

  it('convierte PaginatedResult en { data, meta }', () => {
    const meta = { page: 1, limit: 10, total: 1, totalPages: 1 };
    expect(wrapResponse(new PaginatedResult([{ id: '1' }], meta))).toEqual({
      data: [{ id: '1' }],
      meta,
    });
  });

  it('no envuelve StreamableFile', () => {
    const file = new StreamableFile(Buffer.from('a'));
    expect(wrapResponse(file)).toBe(file);
  });

  it('no envuelve respuestas vacías (204)', () => {
    expect(wrapResponse(undefined)).toBeUndefined();
  });
});

describe('TransformInterceptor', () => {
  it('aplica wrapResponse al flujo del handler', async () => {
    const interceptor = new TransformInterceptor();
    const next: CallHandler = { handle: () => of({ ok: true }) };
    const result = await lastValueFrom(
      interceptor.intercept({} as ExecutionContext, next),
    );
    expect(result).toEqual({ data: { ok: true } });
  });
});
