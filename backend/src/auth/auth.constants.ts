export const SESSION_COOKIE = 'cmpc_session';

/** Límite de intentos de login por IP. */
export const LOGIN_THROTTLE = { name: 'login', ttl: 60_000, limit: 5 } as const;

export interface JwtPayload {
  sub: string;
  email: string;
  /** `tokenVersion` del usuario al emitir el token; deja de coincidir tras el logout. */
  tv: number;
}
