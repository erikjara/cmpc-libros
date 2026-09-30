import { ApiProperty } from '@nestjs/swagger';

export class CatalogItemDto {
  @ApiProperty({ example: '3f2b8a54-5f0e-4f7c-9a57-3a5f9b2f6e10' })
  id: string;

  @ApiProperty({ example: 'Isabel Allende' })
  name: string;
}
