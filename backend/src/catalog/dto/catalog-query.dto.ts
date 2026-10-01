import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimToUndefined } from '../../common/transforms/string.transforms.js';
import { NoControlChars } from '../../common/validation/no-control-chars.validator.js';

export class CatalogQueryDto {
  @ApiPropertyOptional({
    description: 'Filtra por nombre (contiene, sin distinguir mayúsculas)',
    maxLength: 100,
    example: 'all',
  })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString({ message: 'search debe ser texto' })
  @NoControlChars('search')
  @MaxLength(100, { message: 'search no puede superar 100 caracteres' })
  search?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser mayor o igual a 1' })
  @Max(50, { message: 'limit no puede ser mayor a 50' })
  limit: number = 20;
}
