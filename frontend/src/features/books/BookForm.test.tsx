import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { BookForm } from './BookForm'
import { PRICE_FORMAT_MESSAGE, type BookFormInput } from './book-form.schema'

const validValues: BookFormInput = {
  title: 'Cien años de soledad',
  authorName: 'Gabriel García Márquez',
  publisherName: 'Editorial Sudamericana',
  genreName: 'Novela',
  price: '15990',
  stock: '5',
}

function renderForm(props: Partial<Parameters<typeof BookForm>[0]> = {}) {
  const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue(undefined)
  const onCancel = vi.fn()
  const utils = renderWithProviders(
    <BookForm submitLabel="Crear libro" onSubmit={onSubmit} onCancel={onCancel} {...props} />,
  )
  return { ...utils, onSubmit, onCancel }
}

describe('BookForm', () => {
  it('deshabilita el envío mientras el formulario está vacío', () => {
    renderForm()
    expect(screen.getByRole('button', { name: 'Crear libro' })).toBeDisabled()
  })

  it('los botones que despliegan autor, editorial y género tienen nombre accesible', async () => {
    const { user } = renderForm()
    expect(screen.getByRole('button', { name: 'Mostrar autores' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mostrar editoriales' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mostrar géneros' }))
    expect(await screen.findByRole('option', { name: 'Poesía' })).toBeInTheDocument()
  })

  it('muestra un ejemplo del formato de precio asociado al campo', () => {
    renderForm()
    expect(screen.getByLabelText('Precio (CLP)')).toHaveAccessibleDescription('Ej.: 15.990')
  })

  it('acepta el punto como separador de miles y la coma decimal', async () => {
    const { user, onSubmit } = renderForm({ defaultValues: { ...validValues, price: '' } })
    await user.type(screen.getByLabelText('Precio (CLP)'), '15.990,5')
    await user.click(screen.getByRole('button', { name: 'Crear libro' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ price: 15990.5 }), null, expect.anything()))
  })

  it('valida de forma reactiva el título, el precio y el stock', async () => {
    const { user } = renderForm()
    await user.type(screen.getByLabelText('Título'), 'a')
    await user.clear(screen.getByLabelText('Título'))
    expect(await screen.findByText('Ingresa el título')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Precio (CLP)'), '12,999')
    expect(await screen.findByText(PRICE_FORMAT_MESSAGE)).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Precio (CLP)'))
    await user.type(screen.getByLabelText('Precio (CLP)'), '100000000')
    expect(await screen.findByText('El precio máximo es 99.999.999,99')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Stock'), '-1')
    expect(await screen.findByText('El stock debe ser un número entero mayor o igual a 0')).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Stock'))
    await user.type(screen.getByLabelText('Stock'), '2.5')
    expect(await screen.findByText('El stock debe ser un número entero mayor o igual a 0')).toBeInTheDocument()
  })

  it('envía números y nombres de catálogo según el contrato', async () => {
    const { user, onSubmit } = renderForm({ defaultValues: { ...validValues, price: '15990,5' } })
    const submit = screen.getByRole('button', { name: 'Crear libro' })
    await waitFor(() => expect(submit).toBeEnabled())
    await user.click(submit)
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        {
          title: 'Cien años de soledad',
          authorName: 'Gabriel García Márquez',
          publisherName: 'Editorial Sudamericana',
          genreName: 'Novela',
          price: 15990.5,
          stock: 5,
        },
        null,
        {},
      ),
    )
  })

  it('recorta espacios del título antes de enviar', async () => {
    const { user, onSubmit } = renderForm({ defaultValues: { ...validValues, title: '  Rayuela  ' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Crear libro' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Crear libro' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Rayuela' }), null, expect.anything()))
  })

  it('permite elegir un autor existente desde el combobox', async () => {
    const { user, onSubmit } = renderForm({ defaultValues: { ...validValues, authorName: '' } })
    await user.type(screen.getByLabelText('Autor'), 'allende')
    await user.click(await screen.findByRole('option', { name: 'Isabel Allende' }))
    await user.click(screen.getByRole('button', { name: 'Crear libro' }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ authorName: 'Isabel Allende' }), null, expect.anything()),
    )
  })

  it('envía el autor escrito aunque se salga del campo con Tab sin elegir una opción', async () => {
    const { user, onSubmit } = renderForm({ defaultValues: { ...validValues, authorName: '' } })
    const submit = screen.getByRole('button', { name: 'Crear libro' })
    await user.type(screen.getByLabelText('Autor'), 'Roberto Bolaño')
    await user.tab()
    await waitFor(() => expect(submit).toBeEnabled())
    await user.click(submit)
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ authorName: 'Roberto Bolaño' }), null, expect.anything()),
    )
  })

  it('incluye la imagen seleccionada al enviar', async () => {
    const { user, onSubmit } = renderForm({ defaultValues: validValues })
    const file = new File([new Uint8Array(10)], 'portada.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Portada'), file)
    await user.click(screen.getByRole('button', { name: 'Crear libro' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.any(Object), file, {}))
  })

  it('deshabilita el botón y muestra "Guardando…" mientras envía', async () => {
    let resolveSubmit: () => void = () => {}
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => (resolveSubmit = resolve)))
    const { user } = renderForm({ defaultValues: validValues, onSubmit })
    await user.click(screen.getByRole('button', { name: 'Crear libro' }))
    expect(await screen.findByRole('button', { name: 'Guardando…' })).toBeDisabled()
    resolveSubmit()
    expect(await screen.findByRole('button', { name: 'Crear libro' })).toBeEnabled()
  })

  it('informa en `changes` solo los campos modificados', async () => {
    const { user, onSubmit } = renderForm({ defaultValues: validValues })
    const title = screen.getByLabelText('Título')
    await user.clear(title)
    await user.type(title, 'Rayuela')
    await user.click(screen.getByRole('button', { name: 'Crear libro' }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ stock: 5 }), null, { title: 'Rayuela' }),
    )
  })

  it('con requireChanges solo habilita el envío si hay cambios y los informa', async () => {
    const onChangesStatus = vi.fn()
    const { user } = renderForm({ defaultValues: validValues, requireChanges: true, onChangesStatus })
    const submit = screen.getByRole('button', { name: 'Crear libro' })
    await waitFor(() => expect(onChangesStatus).toHaveBeenLastCalledWith(false))
    expect(submit).toBeDisabled()
    await user.type(screen.getByLabelText('Stock'), '0')
    await waitFor(() => expect(submit).toBeEnabled())
    expect(onChangesStatus).toHaveBeenLastCalledWith(true)
  })

  it('submitBlocked impide enviar aunque el formulario sea válido', async () => {
    renderForm({ defaultValues: validValues, submitBlocked: true })
    await waitFor(() => expect(screen.getByLabelText('Título')).toHaveValue('Cien años de soledad'))
    expect(screen.getByRole('button', { name: 'Crear libro' })).toBeDisabled()
  })

  it('llama a onCancel', async () => {
    const { user, onCancel } = renderForm()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
