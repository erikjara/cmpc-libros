import { describe, expect, it, vi } from 'vitest';
import { DEMO_JWT_SECRETS, warnIfDemoJwtSecret } from './demo-secret.js';

describe('warnIfDemoJwtSecret', () => {
  it('conoce los secretos de ejemplo de backend/.env.example y del .env.example raíz', () => {
    expect(DEMO_JWT_SECRETS).toEqual([
      'cambia-este-secreto-por-uno-de-al-menos-32-caracteres',
      'demo-local-reemplazar-por-un-secreto-aleatorio-de-48-bytes',
    ]);
  });

  it.each(DEMO_JWT_SECRETS)(
    'advierte en producción si JWT_SECRET es el de ejemplo (%s)',
    (secret) => {
      const logger = { warn: vi.fn() };
      warnIfDemoJwtSecret(
        { NODE_ENV: 'production', JWT_SECRET: secret },
        logger,
      );
      expect(logger.warn).toHaveBeenCalledOnce();
      const message = String(logger.warn.mock.calls[0][0]);
      expect(message).toContain('JWT_SECRET');
      expect(message).toContain('antes de un despliegue real');
      expect(message).not.toContain(secret);
    },
  );

  it('no advierte con un secreto propio en producción', () => {
    const logger = { warn: vi.fn() };
    warnIfDemoJwtSecret(
      { NODE_ENV: 'production', JWT_SECRET: 'z'.repeat(48) },
      logger,
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('no advierte fuera de producción aunque se use el secreto de ejemplo', () => {
    const logger = { warn: vi.fn() };
    warnIfDemoJwtSecret(
      { NODE_ENV: 'development', JWT_SECRET: DEMO_JWT_SECRETS[0] },
      logger,
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
