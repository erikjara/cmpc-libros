import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';
import type { Env } from '../../config/env.schema.js';

export const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const HEALTH_PATH = '/api/health';

/** Reutiliza el X-Request-Id entrante si es seguro; si no, genera un UUID. */
export function resolveRequestId(
  incoming: string | string[] | undefined,
): string {
  return typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming)
    ? incoming
    : randomUUID();
}

export function generateRequestId(
  req: IncomingMessage,
  res: ServerResponse,
): string {
  const id = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
  res.setHeader('X-Request-Id', id);
  return id;
}

export function isHealthCheck(req: IncomingMessage): boolean {
  const url =
    (req as IncomingMessage & { originalUrl?: string }).originalUrl ??
    req.url ??
    '';
  return url.startsWith(HEALTH_PATH);
}

export function logLevelFor(
  nodeEnv: Env['NODE_ENV'],
): 'debug' | 'info' | 'silent' {
  if (nodeEnv === 'test') {
    return 'silent';
  }
  return nodeEnv === 'production' ? 'info' : 'debug';
}

export function buildLoggerParams(nodeEnv: Env['NODE_ENV']): Params {
  return {
    pinoHttp: {
      level: logLevelFor(nodeEnv),
      genReqId: generateRequestId,
      customAttributeKeys: { reqId: 'requestId', responseTime: 'durationMs' },
      quietReqLogger: true,
      autoLogging: { ignore: isHealthCheck },
      serializers: {
        req: (req: { method: string; url: string }) => ({
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    },
  };
}
