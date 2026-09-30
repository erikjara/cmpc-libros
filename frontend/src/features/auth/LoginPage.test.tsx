import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db } from '@/test/msw/db'
import { renderWithProviders } from '@/test/render'
import { LoginPage } from './LoginPage'
import { sessionQueryKey } from './session'

function renderLogin(initialEntry = '/login') {
  db.sessionUser = null
  return renderWithProviders(<LoginPage />, { path: '/login', initialEntry })
}

describe('LoginPage', () => {
  it('deshabilita el envío mientras el formulario es inválido', async () => {
    const { user } = renderLogin()
    const submit = screen.getByRole('button', { name: 'Ingresar' })
    expect(submit).toBeDisabled()
    await user.type(screen.getByLabelText('Correo'), 'admin@cmpc.cl')
    expect(submit).toBeDisabled()
    await user.type(screen.getByLabelText('Contraseña'), 'x')
    expect(submit).toBeEnabled()
  })

  it('muestra errores de validación mientras se escribe', async () => {
    const { user } = renderLogin()
    await user.type(screen.getByLabelText('Correo'), 'no-es-correo')
    expect(await screen.findByText('Ingresa un correo válido')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Contraseña'), 'a')
    await user.clear(screen.getByLabelText('Contraseña'))
    expect(await screen.findByText('Ingresa tu contraseña')).toBeInTheDocument()
  })

  it('inicia sesión, guarda el usuario y navega a redirectTo', async () => {
    const { user, queryClient } = renderLogin('/login?redirectTo=%2Fbooks%3Fpage%3D2')
    await user.type(screen.getByLabelText('Correo'), 'admin@cmpc.cl')
    await user.type(screen.getByLabelText('Contraseña'), 'Admin123!')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/books?page=2')
    expect(queryClient.getQueryData(sessionQueryKey)).toMatchObject({ email: 'admin@cmpc.cl' })
  })

  it('navega a /books si no hay redirectTo', async () => {
    const { user } = renderLogin()
    await user.type(screen.getByLabelText('Correo'), 'admin@cmpc.cl')
    await user.type(screen.getByLabelText('Contraseña'), 'Admin123!')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/books')
  })

  it('muestra el mensaje del servidor ante credenciales inválidas', async () => {
    const { user } = renderLogin()
    await user.type(screen.getByLabelText('Correo'), 'admin@cmpc.cl')
    await user.type(screen.getByLabelText('Contraseña'), 'incorrecta')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas')
  })
})
