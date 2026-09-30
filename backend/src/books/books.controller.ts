import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReqContext } from '../common/decorators/request-context.decorator.js';
import type { PaginatedResult } from '../common/pagination/pagination.js';
import {
  ApiDataResponse,
  ApiErrors,
} from '../common/swagger/api-docs.decorators.js';
import type { RequestContext } from '../common/types/request-context.js';
import { UUID_PARAM_PIPE } from '../common/validation/uuid-param.pipe.js';
import type { BookDto } from './book.mapper.js';
import { BooksService } from './books.service.js';
import { BookListQueryDto } from './dto/book-list-query.dto.js';
import { BookResponseDto } from './dto/book-response.dto.js';
import { CreateBookDto } from './dto/create-book.dto.js';
import { UpdateBookDto } from './dto/update-book.dto.js';

@ApiTags('Libros')
@ApiCookieAuth()
@ApiBearerAuth()
@ApiErrors(401)
@Controller('books')
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @Get()
  @ApiOperation({
    summary: 'Listado paginado con búsqueda, filtros y orden múltiple',
  })
  @ApiDataResponse(BookResponseDto, { paginated: true })
  @ApiErrors(400)
  list(@Query() query: BookListQueryDto): Promise<PaginatedResult<BookDto>> {
    return this.books.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un libro' })
  @ApiDataResponse(BookResponseDto)
  @ApiErrors(400, 404)
  findOne(@Param('id', UUID_PARAM_PIPE) id: string): Promise<BookDto> {
    return this.books.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Crea un libro (autor, editorial y género por nombre)',
  })
  @ApiDataResponse(BookResponseDto, {
    status: 201,
    description: 'Libro creado',
  })
  @ApiErrors(400, 409)
  create(
    @Body() dto: CreateBookDto,
    @ReqContext() context: RequestContext,
  ): Promise<BookDto> {
    return this.books.create(dto, context);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edición parcial (al menos un campo)' })
  @ApiDataResponse(BookResponseDto)
  @ApiErrors(400, 404, 409)
  update(
    @Param('id', UUID_PARAM_PIPE) id: string,
    @Body() dto: UpdateBookDto,
    @ReqContext() context: RequestContext,
  ): Promise<BookDto> {
    return this.books.update(id, dto, context);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminación lógica (soft delete)' })
  @ApiResponse({ status: 204, description: 'Libro eliminado' })
  @ApiErrors(400, 404)
  remove(
    @Param('id', UUID_PARAM_PIPE) id: string,
    @ReqContext() context: RequestContext,
  ): Promise<void> {
    return this.books.remove(id, context);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revierte la eliminación lógica' })
  @ApiDataResponse(BookResponseDto)
  @ApiErrors(400, 404)
  restore(
    @Param('id', UUID_PARAM_PIPE) id: string,
    @ReqContext() context: RequestContext,
  ): Promise<BookDto> {
    return this.books.restore(id, context);
  }
}
