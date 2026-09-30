import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto.js';

export class AuditLogResponseDto {
  @ApiProperty({ example: '9d1e2f3a-4b5c-4d6e-8f70-8192a3b4c5d6' })
  id: string;

  @ApiProperty({
    enum: ['CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'EXPORT', 'LOGIN'],
    example: 'UPDATE',
  })
  action: string;

  @ApiProperty({ example: 'Book' })
  entity: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '3f2b8a54-5f0e-4f7c-9a57-3a5f9b2f6e10',
  })
  entityId: string | null;

  @ApiProperty({ type: UserResponseDto, nullable: true })
  user: UserResponseDto | null;

  @ApiProperty({
    type: 'object',
    nullable: true,
    additionalProperties: true,
    example: { before: { stock: 3 }, after: { stock: 5 } },
  })
  changes: unknown;

  @ApiProperty({ type: String, nullable: true, example: '172.18.0.1' })
  ip: string | null;

  @ApiProperty({ example: '2026-09-30T12:00:00.000Z' })
  createdAt: string;
}
