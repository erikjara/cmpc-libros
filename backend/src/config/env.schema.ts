import * as z from 'zod';

const DURATION_PATTERN = /^(\d+)([smhd])$/;
const UNIT_TO_MS = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

export function durationToMs(value: string): number {
  const match = DURATION_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Duración inválida: "${value}"`);
  }
  const unit = match[2] as keyof typeof UNIT_TO_MS;
  return Number(match[1]) * UNIT_TO_MS[unit];
}

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z
    .string()
    .regex(
      DURATION_PATTERN,
      'JWT_EXPIRES_IN debe tener el formato <número><s|m|h|d>, por ejemplo 8h',
    )
    .default('8h'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  CORS_ORIGIN: z
    .url('CORS_ORIGIN debe ser una URL válida')
    .default('http://localhost:5173'),
  UPLOADS_DIR: z.string().min(1).default('./uploads'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuración inválida: ${details}`);
  }
  return result.data;
}
