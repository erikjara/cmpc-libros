import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../common/decorators/public.decorator.js';
import { ApiErrors } from '../common/swagger/api-docs.decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

const DB_TIMEOUT_MS = 1500;

@ApiTags('Salud')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Estado de la API y de la base de datos' })
  @ApiErrors(503)
  check() {
    return this.health.check([
      () =>
        this.prismaIndicator
          .pingCheck('database', this.prisma)
          .withTimeout(DB_TIMEOUT_MS),
    ]);
  }
}
