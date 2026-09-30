import type {
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('verifica la base de datos con PrismaHealthIndicator', async () => {
    const health = mock<HealthCheckService>();
    const indicator = mock<PrismaHealthIndicator>();
    const prisma = {} as PrismaService;
    health.check.mockImplementation(async (indicators) => {
      for (const indicator of indicators) {
        if (typeof indicator === 'function') {
          await indicator();
        }
      }
      return { status: 'ok', info: {}, error: {}, details: {} } as never;
    });
    const withTimeout = vi
      .fn()
      .mockResolvedValue({ database: { status: 'up' } });
    indicator.pingCheck.mockReturnValue({ withTimeout } as never);

    const controller = new HealthController(health, indicator, prisma);

    await expect(controller.check()).resolves.toMatchObject({ status: 'ok' });
    expect(indicator.pingCheck).toHaveBeenCalledWith('database', prisma);
    expect(withTimeout).toHaveBeenCalledWith(1500);
  });
});
