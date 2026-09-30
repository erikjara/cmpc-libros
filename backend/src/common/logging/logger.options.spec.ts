import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import {
  buildLoggerParams,
  generateRequestId,
  isHealthCheck,
  logLevelFor,
  resolveRequestId,
} from './logger.options.js';

const UUID = /^[0-9a-f-]{36}$/;

describe('resolveRequestId', () => {
  it('reutiliza un X-Request-Id válido', () => {
    expect(resolveRequestId('abc-12345678')).toBe('abc-12345678');
  });

  it('genera un UUID si el header falta, es múltiple o es inseguro', () => {
    expect(resolveRequestId(undefined)).toMatch(UUID);
    expect(resolveRequestId(['a', 'b'])).toMatch(UUID);
    expect(resolveRequestId('<script>alert(1)</script>')).toMatch(UUID);
  });
});

describe('generateRequestId', () => {
  it('devuelve el id y lo expone en el header X-Request-Id', () => {
    const setHeader = vi.fn();
    const id = generateRequestId(
      {
        headers: { 'x-request-id': 'req-00000001' },
      } as unknown as IncomingMessage,
      { setHeader } as unknown as ServerResponse,
    );
    expect(id).toBe('req-00000001');
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', 'req-00000001');
  });
});

describe('isHealthCheck', () => {
  it('detecta el healthcheck por originalUrl o url', () => {
    expect(
      isHealthCheck({
        originalUrl: '/api/health',
      } as unknown as IncomingMessage),
    ).toBe(true);
    expect(isHealthCheck({ url: '/api/books' } as IncomingMessage)).toBe(false);
    expect(isHealthCheck({} as IncomingMessage)).toBe(false);
  });
});

describe('logLevelFor', () => {
  it('elige el nivel según el entorno', () => {
    expect(logLevelFor('test')).toBe('silent');
    expect(logLevelFor('production')).toBe('info');
    expect(logLevelFor('development')).toBe('debug');
  });
});

describe('buildLoggerParams', () => {
  it('configura requestId y serializers compactos', () => {
    const params = buildLoggerParams('production');
    const pinoHttp = params.pinoHttp as Record<string, any>;
    expect(pinoHttp.level).toBe('info');
    expect(pinoHttp.customAttributeKeys).toEqual({
      reqId: 'requestId',
      responseTime: 'durationMs',
    });
    expect(
      pinoHttp.serializers.req({
        method: 'GET',
        url: '/api/books',
        headers: {},
      }),
    ).toEqual({
      method: 'GET',
      url: '/api/books',
    });
    expect(pinoHttp.serializers.res({ statusCode: 200 })).toEqual({
      statusCode: 200,
    });
  });
});
