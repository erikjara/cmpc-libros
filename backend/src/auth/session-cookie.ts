import type { CookieOptions } from 'express';
import { durationToMs } from '../config/env.schema.js';

export interface SessionCookieSettings {
  secure: boolean;
  expiresIn: string;
}

export function buildSessionCookieOptions(
  settings: SessionCookieSettings,
): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: settings.secure,
    path: '/',
    maxAge: durationToMs(settings.expiresIn),
  };
}

/** Express 5 ignora maxAge en clearCookie; se envían los mismos atributos sin él. */
export function buildClearCookieOptions(
  settings: SessionCookieSettings,
): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: settings.secure,
    path: '/',
  };
}
