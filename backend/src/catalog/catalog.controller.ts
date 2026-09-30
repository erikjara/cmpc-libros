import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiDataResponse,
  ApiErrors,
} from '../common/swagger/api-docs.decorators.js';
import type { CatalogItem } from '../common/types/catalog-item.js';
import { CatalogService } from './catalog.service.js';
import { CatalogItemDto } from './dto/catalog-item.dto.js';
import { CatalogQueryDto } from './dto/catalog-query.dto.js';

@ApiTags('Catálogo')
@ApiCookieAuth()
@ApiBearerAuth()
@ApiErrors(400, 401)
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('authors')
  @ApiOperation({ summary: 'Autores ordenados por nombre (autocomplete)' })
  @ApiDataResponse(CatalogItemDto, { isArray: true })
  authors(@Query() query: CatalogQueryDto): Promise<CatalogItem[]> {
    return this.catalog.authors(query);
  }

  @Get('publishers')
  @ApiOperation({ summary: 'Editoriales ordenadas por nombre (autocomplete)' })
  @ApiDataResponse(CatalogItemDto, { isArray: true })
  publishers(@Query() query: CatalogQueryDto): Promise<CatalogItem[]> {
    return this.catalog.publishers(query);
  }

  @Get('genres')
  @ApiOperation({ summary: 'Géneros ordenados por nombre (autocomplete)' })
  @ApiDataResponse(CatalogItemDto, { isArray: true })
  genres(@Query() query: CatalogQueryDto): Promise<CatalogItem[]> {
    return this.catalog.genres(query);
  }
}
