import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { NoTimeout } from '../common/decorators/no-timeout.decorator.js';
import { ReqContext } from '../common/decorators/request-context.decorator.js';
import type { PaginatedResult } from '../common/pagination/pagination.js';
import {
  ApiDataResponse,
  ApiErrors,
} from '../common/swagger/api-docs.decorators.js';
import type { Response } from 'express';
import type { RequestContext } from '../common/types/request-context.js';
import { UUID_PARAM_PIPE } from '../common/validation/uuid-param.pipe.js';
import { MAX_IMAGE_BYTES } from '../storage/image-type.js';
import type { UploadedImage } from '../storage/storage.service.js';
import type { BookDto } from './book.mapper.js';
import { BooksExportService } from './books-export.service.js';
import { BooksService } from './books.service.js';
import { exportFileName } from './csv.js';
import { BookFiltersDto } from './dto/book-filters.dto.js';
import { BookListQueryDto } from './dto/book-list-query.dto.js';
import { BookResponseDto } from './dto/book-response.dto.js';
import { CreateBookDto } from './dto/create-book.dto.js';
import { UpdateBookDto } from './dto/update-book.dto.js';

type StreamableResponse = Parameters<StreamableFile['errorHandler']>[1];

@ApiTags('Libros')
@ApiCookieAuth()
@ApiBearerAuth()
@ApiErrors(401)
@Controller('books')
export class BooksController {
  private readonly logger = new Logger(BooksController.name);

  constructor(
    private readonly books: BooksService,
    private readonly exporter: BooksExportService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listado paginado con búsqueda, filtros y orden múltiple',
  })
  @ApiDataResponse(BookResponseDto, { paginated: true })
  @ApiErrors(400)
  list(@Query() query: BookListQueryDto): Promise<PaginatedResult<BookDto>> {
    return this.books.list(query);
  }

  // Declarada antes de ':id' para que "export" no se interprete como id.
  @Get('export')
  @NoTimeout()
  @ApiOperation({
    summary: 'Exporta a CSV (streaming) los libros que cumplen los filtros',
  })
  @ApiProduces('text/csv')
  @ApiResponse({ status: 200, description: 'Archivo CSV con BOM UTF-8' })
  @ApiErrors(400)
  async export(
    @Query() filters: BookFiltersDto,
    @ReqContext() context: RequestContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const stream = await this.exporter.createCsvStream(filters, context);
    // Cliente desconectado: se destruye el stream para dejar de leer la base.
    response.on('close', () => {
      if (!stream.readableEnded) {
        stream.destroy();
      }
    });
    return new StreamableFile(stream, {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${exportFileName(new Date())}"`,
    }).setErrorHandler((error, res) => this.abortExport(error, res));
  }

  /**
   * Un fallo a mitad del stream no puede cambiar el status (200 ya enviado). El handler
   * por defecto de Nest cerraría la respuesta con `end()` y el navegador guardaría un CSV
   * truncado como si estuviera completo; destruir la conexión deja la descarga fallida.
   */
  private abortExport(error: Error, res: StreamableResponse): void {
    this.logger.error(
      `Falló la exportación CSV: ${error.stack ?? error.message}`,
    );
    if (!res.destroyed) {
      (res as unknown as Response).destroy(error);
    }
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

  @Post(':id/image')
  @HttpCode(200)
  @NoTimeout()
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    }),
  )
  @ApiOperation({
    summary: 'Sube o reemplaza la imagen (JPEG, PNG o WebP, máx. 2 MB)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image'],
      properties: { image: { type: 'string', format: 'binary' } },
    },
  })
  @ApiDataResponse(BookResponseDto)
  @ApiErrors(400, 404, 413)
  uploadImage(
    @Param('id', UUID_PARAM_PIPE) id: string,
    @UploadedFile() file: UploadedImage | undefined,
    @ReqContext() context: RequestContext,
  ): Promise<BookDto> {
    if (!file) {
      throw new BadRequestException(
        'Debes adjuntar una imagen en el campo "image"',
      );
    }
    return this.books.setImage(id, file, context);
  }
}
