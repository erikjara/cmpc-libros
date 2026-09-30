import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { getCurrentUser } from './current-user.decorator.js';
import { IS_PUBLIC_KEY, Public } from './public.decorator.js';
import { buildRequestContext } from './request-context.decorator.js';

function fakeRequest(partial: Record<string, unknown>): Request {
  return { headers: {}, ...partial } as unknown as Request;
}

describe('Public', () => {
  it('registra la metadata isPublic', () => {
    class Target {
      @Public()
      handler() {}
    }
    const reflector = new Reflector();
    expect(reflector.get(IS_PUBLIC_KEY, Target.prototype.handler)).toBe(true);
  });
});

describe('getCurrentUser', () => {
  it('devuelve req.user', () => {
    const user = { id: 'u1', email: 'a@b.cl' };
    expect(getCurrentUser(fakeRequest({ user }))).toEqual(user);
  });

  it('lanza 401 si no hay usuario', () => {
    expect(() => getCurrentUser(fakeRequest({}))).toThrow(
      UnauthorizedException,
    );
  });
});

describe('buildRequestContext', () => {
  it('extrae usuario, ip y user-agent', () => {
    const request = fakeRequest({
      user: { id: 'u1', email: 'a@b.cl' },
      ip: '10.0.0.1',
      headers: { 'user-agent': 'vitest' },
    });
    expect(buildRequestContext(request)).toEqual({
      userId: 'u1',
      ip: '10.0.0.1',
      userAgent: 'vitest',
    });
  });

  it('usa null cuando faltan datos y recorta user-agent largos', () => {
    const context = buildRequestContext(
      fakeRequest({ headers: { 'user-agent': 'a'.repeat(600) } }),
    );
    expect(context.userId).toBeNull();
    expect(context.ip).toBeNull();
    expect(context.userAgent).toHaveLength(512);
  });

  it('usa null si no hay user-agent', () => {
    expect(buildRequestContext(fakeRequest({})).userAgent).toBeNull();
  });
});
