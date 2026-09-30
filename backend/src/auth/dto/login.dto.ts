import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@cmpc.cl' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'El email no es válido' })
  email: string;

  @ApiProperty({ example: 'Admin123!', minLength: 1, maxLength: 128 })
  @IsString({ message: 'La contraseña es obligatoria' })
  @Length(1, 128, {
    message: 'La contraseña debe tener entre 1 y 128 caracteres',
  })
  password: string;
}
