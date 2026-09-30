import { ApiProperty } from '@nestjs/swagger';

export class ApiErrorBodyDto {
  @ApiProperty({ example: 404 })
  statusCode: number;

  @ApiProperty({ example: 'Not Found' })
  error: string;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Libro no encontrado',
  })
  message: string | string[];

  @ApiProperty({ example: '/api/books/3f2b8a54-5f0e-4f7c-9a57-3a5f9b2f6e10' })
  path: string;

  @ApiProperty({ example: '2026-09-30T12:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: 'b3a1c1e4-7f0a-4c1d-9d2e-1f2a3b4c5d6e' })
  requestId: string;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 57 })
  total: number;

  @ApiProperty({ example: 6 })
  totalPages: number;
}
