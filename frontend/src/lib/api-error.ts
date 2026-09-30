import type { ApiErrorBody } from './api-types'

export class ApiError extends Error {
  readonly status: number
  readonly details?: string[]

  constructor(status: number, message: string, details?: string[]) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export const NETWORK_ERROR_MESSAGE = 'No se pudo conectar con el servidor'
export const UNKNOWN_ERROR_MESSAGE = 'Ocurrió un error inesperado'

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'statusCode' in value &&
    'message' in value
  )
}

export function toApiError(status: number | undefined, body: unknown): ApiError {
  if (status === undefined) {
    return new ApiError(0, NETWORK_ERROR_MESSAGE)
  }
  if (isApiErrorBody(body)) {
    if (Array.isArray(body.message)) {
      return new ApiError(status, body.message[0] ?? UNKNOWN_ERROR_MESSAGE, body.message)
    }
    return new ApiError(status, body.message)
  }
  return new ApiError(status, UNKNOWN_ERROR_MESSAGE)
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return UNKNOWN_ERROR_MESSAGE
}
