import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ImagePicker } from './ImagePicker'
import { MAX_IMAGE_BYTES, validateImage } from './image-validation'

function makeFile(name: string, type: string, size = 1024): File {
  return new File([new Uint8Array(size)], name, { type })
}

describe('validateImage', () => {
  it('acepta jpeg, png y webp de hasta 2 MB', () => {
    expect(validateImage(makeFile('a.jpg', 'image/jpeg'))).toBeNull()
    expect(validateImage(makeFile('a.png', 'image/png', MAX_IMAGE_BYTES))).toBeNull()
    expect(validateImage(makeFile('a.webp', 'image/webp'))).toBeNull()
  })

  it('rechaza otros formatos y archivos de más de 2 MB', () => {
    expect(validateImage(makeFile('a.gif', 'image/gif'))).toBe('Formato no permitido. Usa JPG, PNG o WebP.')
    expect(validateImage(makeFile('a.png', 'image/png', MAX_IMAGE_BYTES + 1))).toBe('La imagen supera el máximo de 2 MB.')
  })
})

describe('ImagePicker', () => {
  it('muestra la portada actual si existe', () => {
    render(<ImagePicker onFileChange={vi.fn()} currentImageUrl="/api/uploads/x.webp" />)
    expect(screen.getByRole('img', { name: 'Vista previa de la portada' })).toHaveAttribute('src', '/api/uploads/x.webp')
  })

  it('acepta una imagen válida y muestra su vista previa', async () => {
    const onFileChange = vi.fn()
    const user = userEvent.setup()
    render(<ImagePicker onFileChange={onFileChange} />)
    const file = makeFile('portada.png', 'image/png')
    await user.upload(screen.getByLabelText('Portada'), file)
    expect(onFileChange).toHaveBeenCalledWith(file)
    expect(screen.getByRole('img', { name: 'Vista previa de la portada' })).toHaveAttribute('src', expect.stringMatching(/^blob:/))
  })

  it('rechaza un formato no permitido sin notificar el archivo', () => {
    const onFileChange = vi.fn()
    render(<ImagePicker onFileChange={onFileChange} />)
    fireEvent.change(screen.getByLabelText('Portada'), {
      target: { files: [makeFile('animacion.gif', 'image/gif')] },
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Formato no permitido')
    expect(onFileChange).not.toHaveBeenCalled()
  })

  it('rechaza imágenes de más de 2 MB', async () => {
    const onFileChange = vi.fn()
    const user = userEvent.setup()
    render(<ImagePicker onFileChange={onFileChange} />)
    await user.upload(screen.getByLabelText('Portada'), makeFile('grande.jpg', 'image/jpeg', MAX_IMAGE_BYTES + 1))
    expect(screen.getByRole('alert')).toHaveTextContent('La imagen supera el máximo de 2 MB.')
    expect(onFileChange).not.toHaveBeenCalled()
  })

  it('elegir un archivo inválido tras uno válido limpia la selección y la vista previa', async () => {
    const onFileChange = vi.fn()
    const user = userEvent.setup()
    render(<ImagePicker onFileChange={onFileChange} currentImageUrl="/api/uploads/actual.webp" />)
    const input = screen.getByLabelText('Portada')
    await user.upload(input, makeFile('portada.png', 'image/png'))
    fireEvent.change(input, { target: { files: [makeFile('animacion.gif', 'image/gif')] } })
    expect(screen.getByRole('alert')).toHaveTextContent('Formato no permitido')
    expect(onFileChange).toHaveBeenLastCalledWith(null)
    expect(screen.getByRole('img', { name: 'Vista previa de la portada' })).toHaveAttribute('src', '/api/uploads/actual.webp')
    expect(screen.queryByRole('button', { name: 'Quitar imagen seleccionada' })).not.toBeInTheDocument()
  })

  it('permite quitar la imagen seleccionada', async () => {
    const onFileChange = vi.fn()
    const user = userEvent.setup()
    render(<ImagePicker onFileChange={onFileChange} />)
    await user.upload(screen.getByLabelText('Portada'), makeFile('portada.webp', 'image/webp'))
    await user.click(screen.getByRole('button', { name: 'Quitar imagen seleccionada' }))
    expect(onFileChange).toHaveBeenLastCalledWith(null)
    expect(screen.queryByRole('img', { name: 'Vista previa de la portada' })).not.toBeInTheDocument()
  })
})
