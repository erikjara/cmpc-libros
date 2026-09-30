import { screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { CatalogCombobox } from './CatalogCombobox'

function Harness({ initial = '', onChange }: { initial?: string; onChange: (value: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <label htmlFor="author">Autor</label>
      <CatalogCombobox
        kind="authors"
        id="author"
        value={value}
        onChange={(next) => {
          setValue(next)
          onChange(next)
        }}
      />
      <output data-testid="value">{value}</output>
    </>
  )
}

describe('CatalogCombobox', () => {
  it('sugiere nombres existentes buscados en el servidor y permite elegir uno', async () => {
    const onChange = vi.fn()
    const { user } = renderWithProviders(<Harness onChange={onChange} />)
    await user.type(screen.getByLabelText('Autor'), 'isa')
    await user.click(await screen.findByRole('option', { name: 'Isabel Allende' }))
    expect(onChange).toHaveBeenLastCalledWith('Isabel Allende')
    expect(screen.getByTestId('value')).toHaveTextContent('Isabel Allende')
  })

  it('ofrece crear el texto escrito cuando no existe', async () => {
    const onChange = vi.fn()
    const { user } = renderWithProviders(<Harness onChange={onChange} />)
    await user.type(screen.getByLabelText('Autor'), 'Roberto Bolaño')
    await user.click(await screen.findByRole('option', { name: 'Crear «Roberto Bolaño»' }))
    expect(onChange).toHaveBeenLastCalledWith('Roberto Bolaño')
  })

  it('confirma el texto escrito (recortado) al salir del campo sin elegir una opción', async () => {
    const onChange = vi.fn()
    const { user } = renderWithProviders(<Harness onChange={onChange} />)
    await user.type(screen.getByLabelText('Autor'), '  Roberto Bolaño  ')
    await user.tab()
    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('Roberto Bolaño'))
    expect(onChange).toHaveBeenLastCalledWith('Roberto Bolaño')
    expect(screen.getByLabelText('Autor')).toHaveValue('Roberto Bolaño')
  })

  it('al salir del campo usa el nombre existente si coincide sin distinguir mayúsculas', async () => {
    const onChange = vi.fn()
    const { user } = renderWithProviders(<Harness onChange={onChange} />)
    await user.type(screen.getByLabelText('Autor'), 'isabel allende')
    await screen.findByRole('option', { name: 'Isabel Allende' })
    await user.tab()
    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('Isabel Allende'))
    expect(onChange).toHaveBeenLastCalledWith('Isabel Allende')
    expect(screen.getByLabelText('Autor')).toHaveValue('Isabel Allende')
  })

  it('resuelve el nombre existente aunque se salga antes de que lleguen las sugerencias', async () => {
    const onChange = vi.fn()
    const { user } = renderWithProviders(<Harness onChange={onChange} />)
    await user.type(screen.getByLabelText('Autor'), 'PABLO NERUDA')
    await user.tab()
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('Pablo Neruda'))
    expect(screen.getByLabelText('Autor')).toHaveValue('Pablo Neruda')
  })

  it('muestra el valor inicial en el input', () => {
    renderWithProviders(<Harness initial="Pablo Neruda" onChange={vi.fn()} />)
    expect(screen.getByLabelText('Autor')).toHaveValue('Pablo Neruda')
  })
})
