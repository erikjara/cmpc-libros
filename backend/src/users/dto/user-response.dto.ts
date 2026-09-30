import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: '3f2b8a54-5f0e-4f7c-9a57-3a5f9b2f6e10' })
  id: string;

  @ApiProperty({ example: 'admin@cmpc.cl' })
  email: string;

  @ApiProperty({ example: 'Administrador' })
  name: string;
}
