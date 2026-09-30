import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { createQueryClient } from './query-client'

describe('createQueryClient', () => {
  it('no reintenta errores 4xx y reintenta hasta 2 veces los demás', () => {
    const retry = createQueryClient().getDefaultOptions().queries?.retry as (
      failureCount: number,
      error: unknown,
    ) => boolean
    expect(retry(0, new ApiError(404, 'x'))).toBe(false)
    expect(retry(0, new ApiError(500, 'x'))).toBe(true)
    expect(retry(1, new ApiError(0, 'x'))).toBe(true)
    expect(retry(2, new ApiError(500, 'x'))).toBe(false)
  })
})
