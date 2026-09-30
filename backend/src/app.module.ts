import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module.js';
import { BooksModule } from './books/books.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { buildLoggerParams } from './common/logging/logger.options.js';
import { validateEnv, type Env } from './config/env.schema.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        buildLoggerParams(config.get('NODE_ENV', { infer: true })),
    }),
    PrismaModule,
    AuthModule,
    BooksModule,
    CatalogModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
