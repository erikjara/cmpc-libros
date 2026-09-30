import axios, { AxiosError } from 'axios'
import { toApiError } from './api-error'

export const httpClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { Accept: 'application/json' },
})

type UnauthorizedHandler = () => void

let unauthorizedHandler: UnauthorizedHandler | null = null

// Rutas cuyo 401 es parte del flujo normal y no significa "sesión expirada".
const SESSION_PROBE_URLS = ['/auth/login', '/auth/me']

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler
}

httpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (!(error instanceof AxiosError)) {
      return Promise.reject(error)
    }
    const status = error.response?.status
    const url = error.config?.url ?? ''
    if (status === 401 && !SESSION_PROBE_URLS.includes(url)) {
      unauthorizedHandler?.()
    }
    return Promise.reject(toApiError(status, error.response?.data))
  },
)
