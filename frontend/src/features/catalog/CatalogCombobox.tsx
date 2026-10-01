import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import type { CatalogKind } from '@/lib/api-types'
import { useDebounce } from '@/shared/useDebounce'
import { CATALOG_TRIGGER_LABELS } from './catalog-labels'
import { catalogQueryOptions, useCatalogOptions } from './catalog.queries'

interface CatalogComboboxProps {
  kind: CatalogKind
  id: string
  value: string
  onChange: (name: string) => void
  onBlur?: () => void
  invalid?: boolean
  placeholder?: string
}

function findName(names: readonly string[], text: string): string | undefined {
  const lower = text.toLowerCase()
  return names.find((name) => name.toLowerCase() === lower)
}

// Combobox "elegir o crear": sugiere nombres existentes y ofrece crear el texto escrito.
// El backend hace upsert por nombre, así que basta con enviar el nombre elegido.
// Al perder el foco se confirma el texto escrito: Base UI, al cerrar sin selección, restaura el
// input al valor seleccionado y descartaría lo escrito.
export function CatalogCombobox({
  kind,
  id,
  value,
  onChange,
  onBlur,
  invalid = false,
  placeholder,
}: CatalogComboboxProps) {
  const queryClient = useQueryClient()
  const [inputValue, setInputValue] = useState(value)
  // Texto confirmado cuya resolución contra el servidor sigue pendiente; se descarta si el
  // usuario vuelve a escribir o elige una opción antes de que llegue la respuesta.
  const pendingLookupRef = useRef<string | null>(null)
  const debouncedInput = useDebounce(inputValue, 300)
  const search = debouncedInput === value ? '' : debouncedInput
  const { data: options = [] } = useCatalogOptions(kind, search)

  const trimmed = inputValue.trim()
  const names = useMemo(() => options.map((option) => option.name), [options])
  const exactMatch = names.some((name) => name.toLowerCase() === trimmed.toLowerCase())
  const items = useMemo(() => {
    const base = value && !names.includes(value) ? [value, ...names] : names
    return trimmed && !exactMatch && trimmed !== value ? [...base, trimmed] : base
  }, [names, value, trimmed, exactMatch])

  const commit = (next: string) => {
    setInputValue(next)
    if (next !== value) onChange(next)
  }

  const handleBlur = () => {
    const text = inputValue.trim()
    const known = findName(names, text)
    commit(known ?? text)
    onBlur?.()
    pendingLookupRef.current = null
    if (!text || known) return
    // Las sugerencias pueden no haber llegado aún (debounce): se consulta el nombre exacto para
    // reutilizar el existente con sus mayúsculas en vez de crear un duplicado.
    pendingLookupRef.current = text
    queryClient.fetchQuery(catalogQueryOptions(kind, text)).then(
      (found) => {
        if (pendingLookupRef.current !== text) return
        pendingLookupRef.current = null
        const match = findName(
          found.map((item) => item.name),
          text,
        )
        if (match && match !== text) {
          setInputValue(match)
          onChange(match)
        }
      },
      () => {
        pendingLookupRef.current = null
      },
    )
  }

  return (
    <Combobox<string>
      items={items}
      filter={null}
      value={value || null}
      onValueChange={(next) => {
        pendingLookupRef.current = null
        onChange(next ?? '')
        setInputValue(next ?? '')
      }}
      inputValue={inputValue}
      onInputValueChange={(next, details) => {
        if (details.reason === 'input-change') pendingLookupRef.current = null
        setInputValue(next)
      }}
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        aria-invalid={invalid}
        onBlur={handleBlur}
        className="w-full"
        triggerLabel={CATALOG_TRIGGER_LABELS[kind]}
      />
      <ComboboxContent>
        <ComboboxEmpty>Sin resultados</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {names.includes(item) || item === value ? item : `Crear «${item}»`}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
