import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { trimToUndefined } from '../../common/transforms/string.transforms.js';
import { SORT_PATTERN } from '../book-query.js';

export class BookFiltersDto {
  @ApiPropertyOptional({
    description: 'Texto a buscar en título y autor',
    maxLength: 100,
    example: 'allende',
  })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString({ message: 'search debe ser texto' })
  @Length(1, 100, { message: 'search debe tener entre 1 y 100 caracteres' })
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsUUID('all', { message: 'authorId debe ser un UUID válido' })
  authorId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsUUID('all', { message: 'publisherId debe ser un UUID válido' })
  publisherId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsUUID('all', { message: 'genreId debe ser un UUID válido' })
  genreId?: string;

  @ApiPropertyOptional({
    enum: ['true', 'false'],
    description: 'true = con stock, false = agotado',
  })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsIn(['true', 'false'], { message: "available debe ser 'true' o 'false'" })
  available?: 'true' | 'false';

  @ApiPropertyOptional({
    description:
      'Orden múltiple campo:dir separado por comas. Campos: title, price, stock, createdAt, author, publisher, genre',
    example: 'price:desc,title:asc',
    default: 'createdAt:desc',
  })
  @IsOptional()
  @Transform(trimToUndefined)
  @Matches(SORT_PATTERN, {
    message:
      'sort debe tener el formato campo:asc|desc separado por comas (campos: title, price, stock, createdAt, author, publisher, genre)',
  })
  sort?: string;
}
