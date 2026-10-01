import { ApiProperty } from '@nestjs/swagger';
// Clave de metadata que usa @nestjs/swagger para @ApiResponse (su módulo de constantes no se exporta).
const API_RESPONSE_METADATA = 'swagger/apiResponse';
import { describe, expect, it } from 'vitest';
import { ApiDataResponse, ApiErrors } from './api-docs.decorators.js';
import { ApiErrorBodyDto } from './dto/api-error-body.dto.js';

class ItemDto {
  @ApiProperty()
  id: string;
}

class DocsTarget {
  @ApiDataResponse(ItemDto)
  single() {}

  @ApiDataResponse(ItemDto, {
    isArray: true,
    status: 201,
    description: 'Creado',
  })
  list() {}

  @ApiDataResponse(ItemDto, { paginated: true })
  paginated() {}

  @ApiDataResponse(ItemDto, { etag: true })
  versioned() {}

  @ApiErrors(400, 404, 412, 999)
  failing() {}
}

function responses(method: keyof DocsTarget): Record<string, any> {
  return Reflect.getMetadata(
    API_RESPONSE_METADATA,
    DocsTarget.prototype[method],
  );
}

describe('ApiDataResponse', () => {
  it('documenta { data } con referencia al modelo', () => {
    const schema = responses('single')['200'].schema;
    expect(schema.required).toEqual(['data']);
    expect(schema.properties.data).toEqual({
      $ref: '#/components/schemas/ItemDto',
    });
  });

  it('documenta arreglos con status y descripción personalizados', () => {
    const response = responses('list')['201'];
    expect(response.description).toBe('Creado');
    expect(response.schema.properties.data.type).toBe('array');
  });

  it('documenta el header ETag solo si se pide', () => {
    expect(responses('versioned')['200'].headers.ETag.schema.type).toBe(
      'string',
    );
    expect(responses('single')['200'].headers).toBeUndefined();
  });

  it('documenta { data, meta } en respuestas paginadas', () => {
    const schema = responses('paginated')['200'].schema;
    expect(schema.required).toEqual(['data', 'meta']);
    expect(schema.properties.meta).toEqual({
      $ref: '#/components/schemas/PaginationMetaDto',
    });
  });
});

describe('ApiErrors', () => {
  it('documenta cada status con el cuerpo de error uniforme', () => {
    const documented = responses('failing');
    expect(Object.keys(documented)).toEqual(['400', '404', '412', '999']);
    expect(documented['412'].description).toMatch(/If-Match/);
    expect(documented['404'].type).toBe(ApiErrorBodyDto);
    expect(documented['999'].description).toBe('Error');
  });
});
