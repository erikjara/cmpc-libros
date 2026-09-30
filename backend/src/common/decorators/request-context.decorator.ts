import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser, RequestContext } from '../types/request-context.js';

const MAX_USER_AGENT_LENGTH = 512;

export function buildRequestContext(request: Request): RequestContext {
  const user = (request as Request & { user?: AuthUser }).user;
  const userAgent = request.headers['user-agent'];
  return {
    userId: user?.id ?? null,
    ip: request.ip ?? null,
    userAgent: userAgent ? userAgent.slice(0, MAX_USER_AGENT_LENGTH) : null,
  };
}

/** Inyecta `{ userId, ip, userAgent }` para pasarlo explícitamente al service. */
export const ReqContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestContext =>
    buildRequestContext(ctx.switchToHttp().getRequest<Request>()),
);
