import { STATUS_CODES } from 'node:http';

export const INTERNAL_ERROR_MESSAGE = 'Error interno del servidor';
export const INVALID_JSON_MESSAGE =
  'El cuerpo de la solicitud no es un JSON válido';

const DEFAULT_MESSAGES: Record<number, string> = {
  400: 'Solicitud inválida',
  401: 'No autenticado',
  403: 'Acceso denegado',
  404: 'Recurso no encontrado',
  409: 'El recurso ya existe',
  413: 'El contenido enviado supera el tamaño máximo permitido',
  415: 'Tipo de contenido no soportado',
  429: 'Demasiadas solicitudes, intenta nuevamente en un momento',
  503: 'Servicio no disponible',
};

/** Prefijos de mensajes en inglés que emiten Nest, multer o Express y su traducción. */
const FRAMEWORK_MESSAGES: ReadonlyArray<
  readonly [prefix: string, translation: string]
> = [
  ['File too large', 'La imagen supera el tamaño máximo de 2 MB'],
  [
    'Unexpected file field',
    'Campo de archivo inesperado: envía la imagen en el campo "image"',
  ],
  [
    'Unexpected field',
    'Campo de archivo inesperado: envía la imagen en el campo "image"',
  ],
  ['Too many files', 'Solo se permite un archivo'],
  ['Multipart:', 'El formulario multipart es inválido'],
  ['URI malformed', 'La URL contiene caracteres mal codificados'],
];

const ROUTE_NOT_FOUND = /^Cannot [A-Z]+ /;
// Nest convierte el SyntaxError de body-parser en BadRequestException(error.message).
const JSON_SYNTAX_ERROR = /\bJSON\b/;

export function statusText(statusCode: number): string {
  return STATUS_CODES[statusCode] ?? 'Error';
}

export function defaultMessage(statusCode: number): string {
  if (statusCode >= 500 && statusCode !== 503) {
    return INTERNAL_ERROR_MESSAGE;
  }
  return DEFAULT_MESSAGES[statusCode] ?? 'Error en la solicitud';
}

export function translateMessage(
  statusCode: number,
  message: string | string[] | undefined,
): string | string[] {
  if (Array.isArray(message)) {
    return message;
  }
  if (
    message === undefined ||
    message === statusText(statusCode) ||
    ROUTE_NOT_FOUND.test(message) ||
    message.startsWith('ThrottlerException')
  ) {
    return defaultMessage(statusCode);
  }
  if (statusCode === 400 && JSON_SYNTAX_ERROR.test(message)) {
    return INVALID_JSON_MESSAGE;
  }
  return (
    FRAMEWORK_MESSAGES.find(([prefix]) => message.startsWith(prefix))?.[1] ??
    message
  );
}
