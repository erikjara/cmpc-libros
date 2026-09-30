import { IntersectionType } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/pagination/dto/pagination-query.dto.js';
import { BookFiltersDto } from './book-filters.dto.js';

export class BookListQueryDto extends IntersectionType(
  BookFiltersDto,
  PaginationQueryDto,
) {}
