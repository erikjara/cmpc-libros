import {
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { AuditService } from '../audit/audit.service.js';
import type { Env } from '../config/env.schema.js';
import type { User } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { UsersRepository } from '../users/users.repository.js';
import { SESSION_COOKIE } from './auth.constants.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { JwtStrategy } from './jwt.strategy.js';
import { PasswordHasher } from './password-hasher.js';
import {
  buildClearCookieOptions,
  buildSessionCookieOptions,
} from './session-cookie.js';
import { cookieExtractor, jwtFromRequest } from './token-extractor.js';

const user: User = {
  id: 'u1',
  email: 'admin@cmpc.cl',
  name: 'Administrador',
  passwordHash: '$argon2id$hash',
  createdAt: new Date(),
  updatedAt: new Date(),
};
const context = { userId: null, ip: '10.0.0.1', userAgent: 'vitest' };

function configMock(values: Partial<Env>): ConfigService<Env, true> {
  return { get: (key: keyof Env) => values[key] } as unknown as ConfigService<
    Env,
    true
  >;
}

describe('token-extractor', () => {
  it('lee el token de la cookie cmpc_session', () => {
    const request = {
      cookies: { [SESSION_COOKIE]: 'jwt-cookie' },
      headers: {},
    } as unknown as Request;
    expect(cookieExtractor(request)).toBe('jwt-cookie');
    expect(jwtFromRequest(request)).toBe('jwt-cookie');
  });

  it('usa el header Bearer si no hay cookie', () => {
    const request = {
      cookies: {},
      headers: { authorization: 'Bearer jwt-header' },
    } as unknown as Request;
    expect(cookieExtractor(request)).toBeNull();
    expect(jwtFromRequest(request)).toBe('jwt-header');
  });

  it('prioriza la cookie sobre el header', () => {
    const request = {
      cookies: { [SESSION_COOKIE]: 'jwt-cookie' },
      headers: { authorization: 'Bearer jwt-header' },
    } as unknown as Request;
    expect(jwtFromRequest(request)).toBe('jwt-cookie');
  });

  it('devuelve null si no hay token', () => {
    expect(jwtFromRequest({ headers: {} } as unknown as Request)).toBeNull();
    expect(
      cookieExtractor({
        cookies: { [SESSION_COOKIE]: '' },
      } as unknown as Request),
    ).toBeNull();
  });
});

describe('session-cookie', () => {
  it('construye una cookie httpOnly, SameSite=Strict, con maxAge del JWT', () => {
    expect(
      buildSessionCookieOptions({ secure: true, expiresIn: '8h' }),
    ).toEqual({
      httpOnly: true,
      sameSite: 'strict',
      secure: true,
      path: '/',
      maxAge: 28_800_000,
    });
  });

  it('limpia la cookie con los mismos atributos y sin maxAge', () => {
    expect(buildClearCookieOptions({ secure: false, expiresIn: '8h' })).toEqual(
      {
        httpOnly: true,
        sameSite: 'strict',
        secure: false,
        path: '/',
      },
    );
  });
});

describe('JwtStrategy', () => {
  it('convierte el payload en AuthUser', () => {
    const strategy = new JwtStrategy(
      configMock({ JWT_SECRET: 's'.repeat(32) }),
    );
    expect(strategy.validate({ sub: 'u1', email: 'admin@cmpc.cl' })).toEqual({
      id: 'u1',
      email: 'admin@cmpc.cl',
    });
  });
});

describe('JwtAuthGuard', () => {
  function contextFor(isPublic: boolean | undefined): {
    ctx: ExecutionContext;
    reflector: Reflector;
  } {
    const reflector = new Reflector();
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);
    const ctx = {
      getHandler: () => () => undefined,
      getClass: () => class {},
    } as unknown as ExecutionContext;
    return { ctx, reflector };
  }

  it('deja pasar las rutas marcadas con @Public()', () => {
    const { ctx, reflector } = contextFor(true);
    expect(new JwtAuthGuard(reflector).canActivate(ctx)).toBe(true);
  });

  it('delega en passport-jwt para las rutas protegidas', () => {
    const { ctx, reflector } = contextFor(undefined);
    const guard = new JwtAuthGuard(reflector);
    const parent = Object.getPrototypeOf(JwtAuthGuard.prototype) as {
      canActivate: () => unknown;
    };
    const spy = vi.spyOn(parent, 'canActivate').mockReturnValue(true);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it('handleRequest lanza 401 si no hay usuario o hubo error', () => {
    const guard = new JwtAuthGuard(new Reflector());
    expect(() => guard.handleRequest(null, false)).toThrow(
      UnauthorizedException,
    );
    expect(() =>
      guard.handleRequest(new Error('jwt expired'), { id: 'u1' }),
    ).toThrow('No autenticado');
    expect(guard.handleRequest(null, { id: 'u1' })).toEqual({ id: 'u1' });
  });
});

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('genera hashes Argon2id verificables', async () => {
    const hash = await hasher.hash('Secreta123!');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(hasher.verify(hash, 'Secreta123!')).resolves.toBe(true);
    await expect(hasher.verify(hash, 'otra')).resolves.toBe(false);
  });

  it('devuelve false si el usuario no existe (hash null)', async () => {
    await expect(hasher.verify(null, 'cmpc-dummy-password')).resolves.toBe(
      false,
    );
  });

  it('devuelve false ante un hash corrupto', async () => {
    await expect(hasher.verify('no-es-un-hash', 'x')).resolves.toBe(false);
  });
});

describe('AuthService', () => {
  let users: MockProxy<UsersRepository>;
  let hasher: MockProxy<PasswordHasher>;
  let jwt: MockProxy<JwtService>;
  let audit: MockProxy<AuditService>;
  let prisma: PrismaService;
  let service: AuthService;

  beforeEach(() => {
    users = mock<UsersRepository>();
    hasher = mock<PasswordHasher>();
    jwt = mock<JwtService>();
    audit = mock<AuditService>();
    prisma = {} as PrismaService;
    service = new AuthService(users, hasher, jwt, audit, prisma);
  });

  it('login válido firma el JWT, audita LOGIN y devuelve el usuario sin hash', async () => {
    users.findByEmail.mockResolvedValue(user);
    hasher.verify.mockResolvedValue(true);
    jwt.signAsync.mockResolvedValue('signed-jwt');

    const result = await service.login(
      { email: 'admin@cmpc.cl', password: 'Admin123!' },
      context,
    );

    expect(result).toEqual({
      token: 'signed-jwt',
      user: { id: 'u1', email: 'admin@cmpc.cl', name: 'Administrador' },
    });
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'u1',
      email: 'admin@cmpc.cl',
    });
    expect(audit.record).toHaveBeenCalledWith(prisma, {
      action: 'LOGIN',
      entity: 'User',
      entityId: 'u1',
      context: { userId: 'u1', ip: '10.0.0.1', userAgent: 'vitest' },
    });
  });

  it('login con contraseña incorrecta responde 401 sin auditar', async () => {
    users.findByEmail.mockResolvedValue(user);
    hasher.verify.mockResolvedValue(false);

    await expect(
      service.login({ email: 'admin@cmpc.cl', password: 'x' }, context),
    ).rejects.toThrow('Credenciales inválidas');
    expect(audit.record).not.toHaveBeenCalled();
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('registra con warn el intento fallido con email e IP, sin la contraseña', async () => {
    users.findByEmail.mockResolvedValue(user);
    hasher.verify.mockResolvedValue(false);
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await expect(
      service.login(
        { email: 'admin@cmpc.cl', password: 'clave-secreta-123' },
        context,
      ),
    ).rejects.toThrow(UnauthorizedException);

    expect(warn).toHaveBeenCalledOnce();
    const message = String(warn.mock.calls[0][0]);
    expect(message).toContain('admin@cmpc.cl');
    expect(message).toContain('10.0.0.1');
    expect(message).not.toContain('clave-secreta-123');
    warn.mockRestore();
  });

  it('login con email inexistente verifica contra null y responde 401', async () => {
    users.findByEmail.mockResolvedValue(null);
    hasher.verify.mockResolvedValue(false);

    await expect(
      service.login({ email: 'nadie@cmpc.cl', password: 'x' }, context),
    ).rejects.toThrow(UnauthorizedException);
    expect(hasher.verify).toHaveBeenCalledWith(null, 'x');
  });

  it('me devuelve el usuario actual', async () => {
    users.findById.mockResolvedValue(user);
    await expect(service.me('u1')).resolves.toEqual({
      id: 'u1',
      email: 'admin@cmpc.cl',
      name: 'Administrador',
    });
  });

  it('me responde 401 si el usuario ya no existe', async () => {
    users.findById.mockResolvedValue(null);
    await expect(service.me('u1')).rejects.toThrow('Sesión inválida');
  });
});

describe('AuthController', () => {
  let service: MockProxy<AuthService>;
  let controller: AuthController;
  let response: MockProxy<Response>;

  beforeEach(() => {
    service = mock<AuthService>();
    response = mock<Response>();
    controller = new AuthController(
      service,
      configMock({ COOKIE_SECURE: false, JWT_EXPIRES_IN: '8h' }),
    );
  });

  it('login emite la cookie de sesión y devuelve { user }', async () => {
    const dto = { id: 'u1', email: 'admin@cmpc.cl', name: 'Administrador' };
    service.login.mockResolvedValue({ user: dto, token: 'signed-jwt' });

    const result = await controller.login(
      { email: 'admin@cmpc.cl', password: 'x' },
      context,
      response,
    );

    expect(result).toEqual({ user: dto });
    expect(response.cookie).toHaveBeenCalledWith(SESSION_COOKIE, 'signed-jwt', {
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      path: '/',
      maxAge: 28_800_000,
    });
  });

  it('logout limpia la cookie', () => {
    controller.logout(response);
    expect(response.clearCookie).toHaveBeenCalledWith(SESSION_COOKIE, {
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      path: '/',
    });
  });

  it('me delega en AuthService', async () => {
    const dto = { id: 'u1', email: 'admin@cmpc.cl', name: 'Administrador' };
    service.me.mockResolvedValue(dto);
    await expect(
      controller.me({ id: 'u1', email: 'admin@cmpc.cl' }),
    ).resolves.toBe(dto);
  });
});
