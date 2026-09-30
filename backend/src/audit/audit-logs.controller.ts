import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { PaginatedResult } from '../common/pagination/pagination.js';
import {
  ApiDataResponse,
  ApiErrors,
} from '../common/swagger/api-docs.decorators.js';
import type { AuditLogDto } from './audit-log.mapper.js';
import { AuditService } from './audit.service.js';
import { AuditLogQueryDto } from './dto/audit-log-query.dto.js';
import { AuditLogResponseDto } from './dto/audit-log-response.dto.js';

@ApiTags('Auditoría')
@ApiCookieAuth()
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({
    summary: 'Registro de auditoría paginado (más recientes primero)',
  })
  @ApiDataResponse(AuditLogResponseDto, { paginated: true })
  @ApiErrors(400, 401)
  list(
    @Query() query: AuditLogQueryDto,
  ): Promise<PaginatedResult<AuditLogDto>> {
    return this.audit.list(query);
  }
}
