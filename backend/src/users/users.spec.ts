import { beforeEach, describe, expect, it } from 'vitest';
import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended';
import type { User } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { toUserDto } from './user.mapper.js';
import { UsersRepository } from './users.repository.js';

const user: User = {
  id: 'u1',
  email: 'admin@cmpc.cl',
  name: 'Administrador',
  passwordHash: 'hash',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UsersRepository', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let repository: UsersRepository;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    repository = new UsersRepository(prisma);
  });

  it('busca por email', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    await expect(repository.findByEmail('admin@cmpc.cl')).resolves.toBe(user);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'admin@cmpc.cl' },
    });
  });

  it('busca por id', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(repository.findById('u1')).resolves.toBeNull();
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
    });
  });
});

describe('toUserDto', () => {
  it('nunca expone el hash de la contraseña', () => {
    expect(toUserDto(user)).toEqual({
      id: 'u1',
      email: 'admin@cmpc.cl',
      name: 'Administrador',
    });
  });
});
