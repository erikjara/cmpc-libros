import { ApiProperty } from '@nestjs/swagger';
import { CatalogItemDto } from '../../catalog/dto/catalog-item.dto.js';

export class BookResponseDto {
  @ApiProperty({ example: '3f2b8a54-5f0e-4f7c-9a57-3a5f9b2f6e10' })
  id: string;

  @ApiProperty({ example: 'La casa de los espíritus' })
  title: string;

  @ApiProperty({ type: CatalogItemDto })
  author: CatalogItemDto;

  @ApiProperty({ type: CatalogItemDto })
  publisher: CatalogItemDto;

  @ApiProperty({ type: CatalogItemDto })
  genre: CatalogItemDto;

  @ApiProperty({ example: 15990, description: 'CLP' })
  price: number;

  @ApiProperty({ example: 12 })
  stock: number;

  @ApiProperty({ example: true, description: 'Derivado: stock > 0' })
  available: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '/api/uploads/6b1f0c7e-2a4d-4d8b-9f1e-1c2d3e4f5a6b.jpg',
  })
  imageUrl: string | null;

  @ApiProperty({ example: '2026-09-30T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-09-30T12:00:00.000Z' })
  updatedAt: string;
}
