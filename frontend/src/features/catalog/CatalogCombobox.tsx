import { useMemo, useState } from 'react'
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
import { useCatalogOptions } from './catalog.queries'

interface CatalogComboboxProps {
  kind: CatalogKind
  id: string
  value: string
  onChange: (name: string) => void
  onBlur?: () => void
  invalid?: boolean
  placeholder?: string
}

// Combobox "elegir o crear": sugiere nombres existentes y ofrece crear el texto escrito.
// El backend hace upsert por nombre, así que basta con enviar el nombre elegido.
export function CatalogCombobox({
  kind,
  id,
  value,
  onChange,
  onBlur,
  invalid = false,
  placeholder,
}: CatalogComboboxProps) {
  const [inputValue, setInputValue] = useState(value)
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

  return (
    <Combobox<string>
      items={items}
      filter={null}
      value={value || null}
      onValueChange={(next) => {
        onChange(next ?? '')
        setInputValue(next ?? '')
      }}
      inputValue={inputValue}
      onInputValueChange={(next) => setInputValue(next)}
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        aria-invalid={invalid}
        onBlur={onBlur}
        className="w-full"
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
