import { IntersectionType, PickType } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/pagination/dto/pagination-query.dto.js';
import { BookFiltersDto } from './book-filters.dto.js';

/** Papelera: solo búsqueda y paginación (el orden es fijo: eliminación más reciente primero). */
export class TrashQueryDto extends IntersectionType(
  PickType(BookFiltersDto, ['search'] as const),
  PaginationQueryDto,
) {}
