import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { formatDateTime } from '@/lib/formatters'
import { buildAuditLogs } from '@/test/msw/fixtures'
import { errorBody } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { AuditPage } from './AuditPage'

const logs = buildAuditLogs()

function renderAudit(initialEntry = '/audit') {
  return renderWithProviders(<AuditPage />, { path: '/audit', initialEntry })
}

function cellsOf(row: HTMLElement): string[] {
  return within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent ?? '')
}

describe('AuditPage', () => {
  it('muestra un skeleton y luego los registros con fecha, acción, entidad, usuario, IP y cambios', async () => {
    renderAudit()
    expect(screen.getByRole('heading', { name: 'Auditoría' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
    const rows = await screen.findAllByRole('row')
    expect(rows).toHaveLength(11)
    expect(within(rows[0]).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Fecha',
      'Acción',
      'Entidad',
      'Usuario',
      'IP',
      'Cambios',
    ])
    expect(cellsOf(rows[1])).toEqual([
      formatDateTime(logs[0].createdAt),
      'Edición',
      'Libro',
      'Administrador',
      '192.168.1.10',
      'precio: $15.990 → $12.990 · stock: 5 → 0',
    ])
    expect(cellsOf(rows[2]).slice(1, 3)).toEqual(['Exportación', 'Libro'])
    expect(cellsOf(rows[2])[5]).toBe('búsqueda: neruda · disponibilidad: disponibles · orden: título ↑')
    expect(cellsOf(rows[3]).slice(1, 2).concat(cellsOf(rows[3])[5])).toEqual(['Restauración', 'La casa de los espíritus'])
    expect(cellsOf(rows[4])[1]).toBe('Eliminación')
    expect(cellsOf(rows[5])[1]).toBe('Alta')
    expect(cellsOf(rows[6]).slice(1, 3)).toEqual(['Inicio de sesión', 'Usuario'])
    // Registro sin usuario ni IP.
    expect(cellsOf(rows[7]).slice(3)).toEqual(['—', '—', '—'])
  })

  it('filtra por entidad, guarda el filtro en la URL y vuelve a la página 1', async () => {
    const { user, router } = renderAudit('/audit?page=2')
    await screen.findByText(/Página 2 de 2/)
    await user.click(screen.getByLabelText('Entidad'))
    await user.click(await screen.findByRole('option', { name: 'Usuarios' }))
    await waitFor(() => expect(router.state.location.search).toBe('?entity=User'))
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(11))
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows.every((row) => cellsOf(row)[2] === 'Usuario')).toBe(true)
    await user.click(screen.getByLabelText('Entidad'))
    await user.click(await screen.findByRole('option', { name: 'Todos' }))
    await waitFor(() => expect(router.state.location.search).toBe(''))
  })

  it('lee el filtro de la URL e ignora valores no válidos', async () => {
    renderAudit('/audit?entity=Book')
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(6))
    expect(screen.getByLabelText('Entidad')).toHaveTextContent('Libros')
  })

  it('ignora una entidad no válida en la URL', async () => {
    renderAudit('/audit?entity=Author')
    expect(await screen.findAllByRole('row')).toHaveLength(11)
    expect(screen.getByLabelText('Entidad')).toHaveTextContent('Todos')
  })

  it('pagina en el servidor con el estado en la URL', async () => {
    const { user, router } = renderAudit()
    expect(await screen.findByText('16 registros · Página 1 de 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Siguiente/ }))
    expect(router.state.location.search).toBe('?page=2')
    expect(await screen.findByText('16 registros · Página 2 de 2')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(7)
  })

  it('redirige una página fuera de rango a la última página', async () => {
    const { router } = renderAudit('/audit?page=9')
    expect(await screen.findByText('16 registros · Página 2 de 2')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?page=2')
  })

  it('muestra un estado vacío si no hay registros', async () => {
    server.use(
      http.get('/api/audit-logs', () =>
        HttpResponse.json({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }),
      ),
    )
    renderAudit()
    expect(await screen.findByText('No hay registros de auditoría')).toBeInTheDocument()
  })

  it('muestra un error con "Reintentar" y recupera los registros', async () => {
    let fail = true
    server.use(
      http.get('/api/audit-logs', () => {
        if (!fail) return undefined
        return HttpResponse.json(errorBody(500, 'Internal Server Error', 'Error interno del servidor'), { status: 500 })
      }),
    )
    const { user } = renderAudit()
    expect(await screen.findByText('No se pudo cargar la auditoría')).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findAllByRole('row')).toHaveLength(11)
  })
})
