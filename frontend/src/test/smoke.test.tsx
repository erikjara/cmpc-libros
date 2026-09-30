import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/button'

describe('entorno de pruebas', () => {
  it('resuelve el alias @/ y renderiza componentes de shadcn', () => {
    render(<Button>Guardar</Button>)
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument()
  })

  it('incluye los polyfills que jsdom no implementa', () => {
    expect(typeof ResizeObserver).toBe('function')
    expect(typeof IntersectionObserver).toBe('function')
    expect(window.matchMedia('(min-width: 1px)').matches).toBe(false)
    expect(typeof Element.prototype.scrollIntoView).toBe('function')
    expect(typeof Element.prototype.setPointerCapture).toBe('function')
    expect(document.getAnimations()).toEqual([])
  })
})
