import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../config/env.schema.js';
import { PrismaService } from './prisma.service.js';

function createService(): PrismaService {
  const config = {
    get: vi.fn().mockReturnValue('postgresql://u:p@localhost:5432/db'),
  } as unknown as ConfigService<Env, true>;
  return new PrismaService(config);
}

describe('PrismaService', () => {
  it('lee DATABASE_URL de la configuración', () => {
    const config = {
      get: vi.fn().mockReturnValue('postgresql://u:p@localhost:5432/db'),
    } as unknown as ConfigService<Env, true>;
    new PrismaService(config);
    expect(config.get).toHaveBeenCalledWith('DATABASE_URL', { infer: true });
  });

  it('conecta al iniciar el módulo', async () => {
    const service = createService();
    const connect = vi.spyOn(service, '$connect').mockResolvedValue();
    await service.onModuleInit();
    expect(connect).toHaveBeenCalledOnce();
  });

  it('desconecta al destruir el módulo', async () => {
    const service = createService();
    const disconnect = vi.spyOn(service, '$disconnect').mockResolvedValue();
    await service.onModuleDestroy();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
