import { PartialType } from '@nestjs/swagger';
import { CreateBookDto } from './create-book.dto.js';

// skipNullProperties: false → `null` se valida (y se rechaza) en vez de ignorarse.
export class UpdateBookDto extends PartialType(CreateBookDto, {
  skipNullProperties: false,
}) {}
