import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { Env } from '../config/env.schema.js';
import type { AuthUser } from '../common/types/request-context.js';
import { UsersRepository } from '../users/users.repository.js';
import type { JwtPayload } from './auth.constants.js';
import { jwtFromRequest } from './token-extractor.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<Env, true>,
    private readonly users: UsersRepository,
  ) {
    super({
      jwtFromRequest,
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
      algorithms: ['HS256'],
    });
  }

  /** El usuario debe existir y el token no debe haber sido revocado por un logout. */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.users.findById(payload.sub);
    if (!user || user.tokenVersion !== payload.tv) {
      throw new UnauthorizedException('No autenticado');
    }
    return { id: user.id, email: user.email };
  }
}
