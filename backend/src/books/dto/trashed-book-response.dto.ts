import { ApiProperty } from '@nestjs/swagger';
import { BookResponseDto } from './book-response.dto.js';

export class TrashedBookResponseDto extends BookResponseDto {
  @ApiProperty({
    example: '2026-09-30T18:45:00.000Z',
    description: 'Fecha de eliminación (ISO 8601)',
  })
  deletedAt: string;
}
