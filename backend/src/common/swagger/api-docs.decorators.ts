import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import {
  ApiErrorBodyDto,
  PaginationMetaDto,
} from './dto/api-error-body.dto.js';

export interface ApiDataResponseOptions {
  status?: number;
  description?: string;
  isArray?: boolean;
  paginated?: boolean;
}

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: 'Datos de entrada inválidos',
  401: 'No autenticado',
  404: 'Recurso no encontrado',
  409: 'El recurso ya existe',
  413: 'Archivo demasiado grande',
  429: 'Demasiadas solicitudes',
  503: 'Servicio no disponible',
};

/** Documenta una respuesta envuelta por TransformInterceptor: `{ data, meta? }`. */
export function ApiDataResponse(
  model: Type<unknown>,
  options: ApiDataResponseOptions = {},
) {
  const reference = { $ref: getSchemaPath(model) };
  const data =
    options.isArray || options.paginated
      ? { type: 'array' as const, items: reference }
      : reference;
  const properties: Record<string, typeof data> = { data };
  if (options.paginated) {
    properties.meta = { $ref: getSchemaPath(PaginationMetaDto) };
  }

  return applyDecorators(
    ApiExtraModels(model, PaginationMetaDto),
    ApiResponse({
      status: options.status ?? 200,
      description: options.description ?? 'Operación exitosa',
      schema: {
        type: 'object',
        required: Object.keys(properties),
        properties,
      },
    }),
  );
}

/** Documenta las respuestas de error con el formato uniforme de AllExceptionsFilter. */
export function ApiErrors(...statuses: number[]) {
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: ERROR_DESCRIPTIONS[status] ?? 'Error',
        type: ApiErrorBodyDto,
      }),
    ),
  );
}
