import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/msw/server'
import { errorBody } from '@/test/msw/handlers'
import { ApiError, NETWORK_ERROR_MESSAGE } from './api-error'
import { httpClient, setUnauthorizedHandler } from './http-client'

describe('httpClient', () => {
  afterEach(() => setUnauthorizedHandler(null))

  it('usa /api como baseURL y envía credenciales', () => {
    expect(httpClient.defaults.baseURL).toBe('/api')
    expect(httpClient.defaults.withCredentials).toBe(true)
  })

  it('devuelve el cuerpo en respuestas exitosas', async () => {
    const response = await httpClient.get('/auth/me')
    expect(response.data.data.email).toBe('admin@cmpc.cl')
  })

  it('normaliza un error de la API a ApiError con status y mensaje', async () => {
    server.use(
      http.get('/api/books/:id', () =>
        HttpResponse.json(errorBody(404, 'Not Found', 'Recurso no encontrado'), { status: 404 }),
      ),
    )
    const error = await httpClient.get('/books/x').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, message: 'Recurso no encontrado' })
  })

  it('usa el primer mensaje y conserva los detalles en errores de validación', async () => {
    server.use(
      http.post('/api/books', () =>
        HttpResponse.json(
          errorBody(400, 'Bad Request', ['title no debe estar vacío', 'price debe ser positivo']),
          { status: 400 },
        ),
      ),
    )
    const error = await httpClient.post('/books', {}).catch((e: unknown) => e)
    expect(error).toMatchObject({
      status: 400,
      message: 'title no debe estar vacío',
      details: ['title no debe estar vacío', 'price debe ser positivo'],
    })
  })

  it('usa un mensaje genérico si el cuerpo no sigue el contrato', async () => {
    server.use(http.get('/api/books', () => new HttpResponse('boom', { status: 500 })))
    const error = await httpClient.get('/books').catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 500, message: 'Ocurrió un error inesperado' })
  })

  it('traduce un error de red a status 0', async () => {
    server.use(http.get('/api/books', () => HttpResponse.error()))
    const error = await httpClient.get('/books').catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 0, message: NETWORK_ERROR_MESSAGE })
  })

  it('dispara el handler de sesión expirada ante un 401 en rutas protegidas', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    server.use(
      http.get('/api/books', () =>
        HttpResponse.json(errorBody(401, 'Unauthorized', 'No autenticado'), { status: 401 }),
      ),
    )
    await httpClient.get('/books').catch(() => undefined)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('no dispara el handler ante 401 de /auth/login ni /auth/me', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json(errorBody(401, 'Unauthorized', 'No autenticado'), { status: 401 }),
      ),
    )
    await httpClient.get('/auth/me').catch(() => undefined)
    await httpClient
      .post('/auth/login', { email: 'admin@cmpc.cl', password: 'mala' })
      .catch(() => undefined)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})
