import { Injectable } from '@nestjs/common';
import type { User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /**
   * Incrementa `tokenVersion` (invalida todos los tokens emitidos) solo si sigue siendo
   * `tokenVersion`: un token ya revocado no vuelve a cerrar las sesiones nuevas.
   */
  async revokeTokens(id: string, tokenVersion: number): Promise<boolean> {
    const { count } = await this.prisma.user.updateMany({
      where: { id, tokenVersion },
      data: { tokenVersion: { increment: 1 } },
    });
    return count === 1;
  }
}
