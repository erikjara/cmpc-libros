import { describe, expect, it } from 'vitest';
import { durationToMs, validateEnv } from './env.schema.js';

const validEnv = {
  DATABASE_URL: 'postgresql://cmpc:cmpc@localhost:5432/cmpc_libros',
  JWT_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('aplica valores por defecto y convierte tipos', () => {
    const env = validateEnv({
      ...validEnv,
      PORT: '4000',
      COOKIE_SECURE: 'true',
    });

    expect(env).toEqual({
      NODE_ENV: 'development',
      PORT: 4000,
      DATABASE_URL: validEnv.DATABASE_URL,
      JWT_SECRET: validEnv.JWT_SECRET,
      JWT_EXPIRES_IN: '8h',
      COOKIE_SECURE: true,
      CORS_ORIGIN: 'http://localhost:5173',
      UPLOADS_DIR: './uploads',
      SEED_DEMO_DATA: false,
    });
  });

  it('SEED_DEMO_DATA acepta true/false y rechaza otros valores', () => {
    expect(
      validateEnv({ ...validEnv, SEED_DEMO_DATA: 'true' }).SEED_DEMO_DATA,
    ).toBe(true);
    expect(() => validateEnv({ ...validEnv, SEED_DEMO_DATA: 'si' })).toThrow(
      /SEED_DEMO_DATA/,
    );
  });

  it('falla si falta DATABASE_URL', () => {
    expect(() => validateEnv({ JWT_SECRET: 'x'.repeat(32) })).toThrow(
      /Configuración inválida: DATABASE_URL/,
    );
  });

  it('falla si JWT_SECRET tiene menos de 32 caracteres', () => {
    expect(() => validateEnv({ ...validEnv, JWT_SECRET: 'corto' })).toThrow(
      'JWT_SECRET debe tener al menos 32 caracteres',
    );
  });

  it('falla si JWT_EXPIRES_IN no tiene el formato esperado', () => {
    expect(() =>
      validateEnv({ ...validEnv, JWT_EXPIRES_IN: '8 horas' }),
    ).toThrow(/JWT_EXPIRES_IN/);
  });

  it('falla si COOKIE_SECURE no es true/false', () => {
    expect(() => validateEnv({ ...validEnv, COOKIE_SECURE: 'si' })).toThrow(
      /COOKIE_SECURE/,
    );
  });
});

describe('durationToMs', () => {
  it.each([
    ['30s', 30_000],
    ['15m', 900_000],
    ['8h', 28_800_000],
    ['7d', 604_800_000],
  ])('convierte %s a %d ms', (input, expected) => {
    expect(durationToMs(input)).toBe(expected);
  });

  it('rechaza formatos inválidos', () => {
    expect(() => durationToMs('8x')).toThrow('Duración inválida: "8x"');
  });
});
