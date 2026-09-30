import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../types/request-context.js';

export function getCurrentUser(request: Request): AuthUser {
  const user = (request as Request & { user?: AuthUser }).user;
  if (!user) {
    throw new UnauthorizedException('No autenticado');
  }
  return user;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    getCurrentUser(ctx.switchToHttp().getRequest<Request>()),
);
