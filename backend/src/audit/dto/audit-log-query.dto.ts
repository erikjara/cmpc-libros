import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/dto/pagination-query.dto.js';
import type { AuditEntity } from '../audit.types.js';

export class AuditLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['Book', 'User'], example: 'Book' })
  @IsOptional()
  @IsIn(['Book', 'User'], { message: 'entity debe ser Book o User' })
  entity?: AuditEntity;

  @ApiPropertyOptional({ example: '3f2b8a54-5f0e-4f7c-9a57-3a5f9b2f6e10' })
  @IsOptional()
  @IsString({ message: 'entityId debe ser texto' })
  @MaxLength(64, { message: 'entityId no puede superar 64 caracteres' })
  entityId?: string;
}
