import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet, { type HelmetOptions } from 'helmet';
import { SESSION_COOKIE } from './auth/auth.constants.js';
import { UPLOADS_URL_PREFIX } from './books/book.mapper.js';
import { validationExceptionFactory } from './common/validation/validation-exception.factory.js';
import type { Env } from './config/env.schema.js';

export const API_PREFIX = 'api';
export const SWAGGER_PATH = 'api/docs';

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

export function setupSwagger(app: NestExpressApplication): void {
  const config = new DocumentBuilder()
    .setTitle('CMPC-libros API')
    .setDescription(
      'API de inventario de libros. Autenticación por cookie httpOnly `cmpc_session` (login) o header `Authorization: Bearer`.',
    )
    .setVersion('1.0.0')
    .addCookieAuth(SESSION_COOKIE)
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    jsonDocumentUrl: `${SWAGGER_PATH}/openapi.json`,
    swaggerOptions: { persistAuthorization: true, withCredentials: true },
  });
}

/** Configuración HTTP compartida por main.ts y los tests e2e. */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const uploadsDir = resolve(config.get('UPLOADS_DIR', { infer: true }));
  mkdirSync(uploadsDir, { recursive: true });

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
  app.useStaticAssets(uploadsDir, {
    prefix: UPLOADS_URL_PREFIX,
    index: false,
    maxAge: '7d',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.enableShutdownHooks();
  setupSwagger(app);
}
