import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from '../audit/audit.module.js';
import { durationToMs, type Env } from '../config/env.schema.js';
import { UsersModule } from '../users/users.module.js';
import { LOGIN_THROTTLE } from './auth.constants.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { PasswordHasher } from './password-hasher.js';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: Math.floor(
            durationToMs(config.get('JWT_EXPIRES_IN', { infer: true })) / 1000,
          ),
        },
      }),
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ...LOGIN_THROTTLE }],
      errorMessage:
        'Demasiados intentos de inicio de sesión, intenta nuevamente en un minuto',
    }),
    UsersModule,
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PasswordHasher],
})
export class AuthModule {}
