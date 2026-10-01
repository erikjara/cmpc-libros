import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNumber, IsString, Length, Max, Min } from 'class-validator';
import { normalizeSpaces } from '../../common/transforms/string.transforms.js';

export const MAX_PRICE = 99_999_999.99;
export const MAX_STOCK = 1_000_000;

export class CreateBookDto {
  @ApiProperty({
    example: 'La casa de los espíritus',
    minLength: 1,
    maxLength: 200,
  })
  @Transform(normalizeSpaces)
  @IsString({ message: 'El título es obligatorio' })
  @Length(1, 200, { message: 'El título debe tener entre 1 y 200 caracteres' })
  title: string;

  @ApiProperty({
    example: 'Isabel Allende',
    description: 'Se reutiliza si existe; si no, se crea',
  })
  @Transform(normalizeSpaces)
  @IsString({ message: 'El autor es obligatorio' })
  @Length(1, 120, { message: 'El autor debe tener entre 1 y 120 caracteres' })
  authorName: string;

  @ApiProperty({
    example: 'Sudamericana',
    description: 'Se reutiliza si existe; si no, se crea',
  })
  @Transform(normalizeSpaces)
  @IsString({ message: 'La editorial es obligatoria' })
  @Length(1, 120, {
    message: 'La editorial debe tener entre 1 y 120 caracteres',
  })
  publisherName: string;

  @ApiProperty({
    example: 'Realismo mágico',
    description: 'Se reutiliza si existe; si no, se crea',
  })
  @Transform(normalizeSpaces)
  @IsString({ message: 'El género es obligatorio' })
  @Length(1, 120, { message: 'El género debe tener entre 1 y 120 caracteres' })
  genreName: string;

  @ApiProperty({
    example: 15990,
    minimum: 0,
    maximum: MAX_PRICE,
    description: 'CLP, máximo 2 decimales',
  })
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: 'El precio debe ser un número con máximo 2 decimales' },
  )
  @Min(0, { message: 'El precio no puede ser negativo' })
  @Max(MAX_PRICE, { message: 'El precio no puede superar 99.999.999,99' })
  price: number;

  @ApiProperty({ example: 12, minimum: 0, maximum: MAX_STOCK })
  @IsInt({ message: 'El stock debe ser un número entero' })
  @Min(0, { message: 'El stock no puede ser negativo' })
  @Max(MAX_STOCK, { message: 'El stock no puede superar 1.000.000' })
  stock: number;
}
