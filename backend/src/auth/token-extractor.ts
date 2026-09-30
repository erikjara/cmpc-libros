import type { Request } from 'express';
import { ExtractJwt, type JwtFromRequestFunction } from 'passport-jwt';
import { SESSION_COOKIE } from './auth.constants.js';

export const cookieExtractor: JwtFromRequestFunction<Request> = (request) => {
  const cookies = request?.cookies as Record<string, unknown> | undefined;
  const token = cookies?.[SESSION_COOKIE];
  return typeof token === 'string' && token.length > 0 ? token : null;
};

/** Toma el JWT de la cookie de sesión o, si no existe, del header Authorization: Bearer. */
export const jwtFromRequest: JwtFromRequestFunction<Request> =
  ExtractJwt.fromExtractors([
    cookieExtractor,
    ExtractJwt.fromAuthHeaderAsBearerToken(),
  ]);
