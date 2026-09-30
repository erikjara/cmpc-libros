import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet, { type HelmetOptions } from 'helmet';
import { validationExceptionFactory } from './common/validation/validation-exception.factory.js';
import type { Env } from './config/env.schema.js';

export const API_PREFIX = 'api';

/**
 * Sin HTTPS (COOKIE_SECURE=false) se omiten HSTS y upgrade-insecure-requests:
 * forzarían https y romperían Swagger UI al servirse por HTTP fuera de localhost.
 */
export function buildHelmetOptions(https: boolean): HelmetOptions {
  return {
    strictTransportSecurity: https,
    contentSecurityPolicy: {
      directives: { upgradeInsecureRequests: https ? [] : null },
    },
  };
}

/** Configuración HTTP compartida por main.ts y los tests e2e. */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Detrás de nginx: req.ip toma la IP real del cliente (auditoría y rate limit).
  app.set('trust proxy', 1);
  app.use(
    helmet(buildHelmetOptions(config.get('COOKIE_SECURE', { infer: true }))),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }),
    credentials: true,
  });
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.enableShutdownHooks();
}
