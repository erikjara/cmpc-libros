import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service.js';
import type { RequestContext } from '../common/types/request-context.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toUserDto, type UserDto } from '../users/user.mapper.js';
import { UsersRepository } from '../users/users.repository.js';
import type { JwtPayload } from './auth.constants.js';
import type { LoginDto } from './dto/login.dto.js';
import { maskEmail } from './mask-email.js';
import { PasswordHasher } from './password-hasher.js';

export interface LoginResult {
  user: UserDto;
  token: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly hasher: PasswordHasher,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  async login(
    credentials: LoginDto,
    context: RequestContext,
  ): Promise<LoginResult> {
    const user = await this.users.findByEmail(credentials.email);
    const valid = await this.hasher.verify(
      user?.passwordHash ?? null,
      credentials.password,
    );
    if (!user || !valid) {
      this.logger.warn(
        `Inicio de sesión fallido: email=${maskEmail(credentials.email)} ip=${context.ip ?? 'desconocida'}`,
      );
      throw new UnauthorizedException('Credenciales inválidas');
    }

    await this.audit.record(this.prisma, {
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      context: { ...context, userId: user.id },
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tv: user.tokenVersion,
    };
    const token = await this.jwt.signAsync(payload);
    return { user: toUserDto(user), token };
  }

  /**
   * Con un token válido incrementa el `tokenVersion` de su usuario: todos los tokens
   * emitidos dejan de servir. Sin token, o con uno inválido o expirado, no hace nada.
   */
  async logout(token: string | null): Promise<void> {
    if (!token) {
      return;
    }
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        algorithms: ['HS256'],
      });
    } catch {
      return;
    }
    if (typeof payload.tv !== 'number') {
      return;
    }
    await this.users.revokeTokens(payload.sub, payload.tv);
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Sesión inválida');
    }
    return toUserDto(user);
  }
}
