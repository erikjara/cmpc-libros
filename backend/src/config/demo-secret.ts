import type { Env } from './env.schema.js';

/**
 * Valores públicos de JWT_SECRET de los `.env.example` (backend y raíz). Se aceptan para
 * que la demo con Docker Compose arranque, pero en producción se advierte al iniciar.
 */
export const DEMO_JWT_SECRETS: readonly string[] = [
  'cambia-este-secreto-por-uno-de-al-menos-32-caracteres',
  'demo-local-reemplazar-por-un-secreto-aleatorio-de-48-bytes',
];

export function warnIfDemoJwtSecret(
  env: Pick<Env, 'NODE_ENV' | 'JWT_SECRET'>,
  logger: { warn(message: string): void },
): void {
  if (
    env.NODE_ENV === 'production' &&
    DEMO_JWT_SECRETS.includes(env.JWT_SECRET)
  ) {
    logger.warn(
      'JWT_SECRET usa el valor de ejemplo del .env.example: cualquiera puede firmar sesiones válidas. ' +
        'Genera uno propio (p. ej. openssl rand -base64 48) antes de un despliegue real.',
    );
  }
}
