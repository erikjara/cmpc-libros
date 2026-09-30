import { screen } from '@testing-library/react'
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

  it('muestra el valor inicial en el input', () => {
    renderWithProviders(<Harness initial="Pablo Neruda" onChange={vi.fn()} />)
    expect(screen.getByLabelText('Autor')).toHaveValue('Pablo Neruda')
  })
})
