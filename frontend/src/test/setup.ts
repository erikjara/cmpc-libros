import '@testing-library/jest-dom/vitest'
import './polyfills'
import { cleanup, configure } from '@testing-library/react'
import { toast } from 'sonner'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { setUnauthorizedHandler } from '@/lib/http-client'
import { resetDb } from './msw/db'
import { server } from './msw/server'

// findBy*/waitFor esperan hasta 3 s (por defecto 1 s) para tolerar hosts con carga alta.
configure({ asyncUtilTimeout: 3000 })

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  // Sonner guarda los toasts activos en un store global y los reenvía al siguiente <Toaster>.
  toast.dismiss()
  setUnauthorizedHandler(null)
  server.resetHandlers()
  resetDb()
})
afterAll(() => server.close())
