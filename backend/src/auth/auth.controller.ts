import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { ReqContext } from '../common/decorators/request-context.decorator.js';
import {
  ApiDataResponse,
  ApiErrors,
} from '../common/swagger/api-docs.decorators.js';
import type {
  AuthUser,
  RequestContext,
} from '../common/types/request-context.js';
import type { Env } from '../config/env.schema.js';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import type { UserDto } from '../users/user.mapper.js';
import { SESSION_COOKIE } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { LoginResponseDto } from './dto/login-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import {
  buildClearCookieOptions,
  buildSessionCookieOptions,
  type SessionCookieSettings,
} from './session-cookie.js';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  private readonly cookieSettings: SessionCookieSettings;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService<Env, true>,
  ) {
    this.cookieSettings = {
      secure: config.get('COOKIE_SECURE', { infer: true }),
      expiresIn: config.get('JWT_EXPIRES_IN', { infer: true }),
    };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Inicia sesión y emite la cookie httpOnly cmpc_session',
  })
  @ApiDataResponse(LoginResponseDto)
  @ApiErrors(400, 401, 429)
  async login(
    @Body() credentials: LoginDto,
    @ReqContext() context: RequestContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: UserDto }> {
    const { user, token } = await this.auth.login(credentials, context);
    response.cookie(
      SESSION_COOKIE,
      token,
      buildSessionCookieOptions(this.cookieSettings),
    );
    return { user };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Cierra la sesión eliminando la cookie' })
  logout(@Res({ passthrough: true }) response: Response): void {
    response.clearCookie(
      SESSION_COOKIE,
      buildClearCookieOptions(this.cookieSettings),
    );
  }

  @Get('me')
  @ApiCookieAuth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuario autenticado' })
  @ApiDataResponse(UserResponseDto)
  @ApiErrors(401)
  me(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.auth.me(user.id);
  }
}
