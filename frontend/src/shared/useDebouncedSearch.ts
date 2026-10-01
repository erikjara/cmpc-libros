import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useDebounce } from './useDebounce'

export const SEARCH_DEBOUNCE_MS = 400

/**
 * Texto de búsqueda local que se confirma con debounce. `value` es el valor confirmado (p. ej.
 * el de la URL): si cambia desde fuera (atrás/adelante, "Limpiar filtros") se sincroniza el
 * input sin que el texto pendiente reviva el valor anterior.
 */
export function useDebouncedSearch(value: string, onCommit: (search: string) => void, delayMs = SEARCH_DEBOUNCE_MS) {
  const [text, setText] = useState(value)
  const debounced = useDebounce(text, delayMs)
  const committed = useRef(value)
  const onCommitRef = useRef(onCommit)

  useLayoutEffect(() => {
    onCommitRef.current = onCommit
  })

  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value
      setText(value)
    }
  }, [value])

  useEffect(() => {
    if (debounced !== committed.current) {
      committed.current = debounced
      onCommitRef.current(debounced)
    }
  }, [debounced])

  return [text, setText] as const
}
