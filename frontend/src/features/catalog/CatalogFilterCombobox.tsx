import { useMemo, useState } from 'react'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import type { CatalogItem, CatalogKind } from '@/lib/api-types'
import { useDebounce } from '@/shared/useDebounce'
import { useCatalogOptions } from './catalog.queries'

interface CatalogFilterComboboxProps {
  kind: CatalogKind
  id: string
  value: string | undefined
  onChange: (id: string | undefined) => void
  placeholder: string
}

// Filtro por id con búsqueda en servidor. El nombre del elemento seleccionado se resuelve con
// la lista sin búsqueda (hasta 50 elementos) para mostrarlo tras recargar la página.
export function CatalogFilterCombobox({ kind, id, value, onChange, placeholder }: CatalogFilterComboboxProps) {
  const [picked, setPicked] = useState<CatalogItem | null>(null)
  const [inputValue, setInputValue] = useState('')
  const debouncedInput = useDebounce(inputValue, 300)
  const { data: defaultOptions = [] } = useCatalogOptions(kind, '')

  const selected = useMemo<CatalogItem | null>(() => {
    if (!value) return null
    if (picked?.id === value) return picked
    return defaultOptions.find((option) => option.id === value) ?? null
  }, [value, picked, defaultOptions])

  const search = debouncedInput === selected?.name ? '' : debouncedInput
  const { data: options = [] } = useCatalogOptions(kind, search)
  const items = useMemo(
    () => (selected && !options.some((option) => option.id === selected.id) ? [selected, ...options] : options),
    [options, selected],
  )

  return (
    <Combobox<CatalogItem>
      items={items}
      filter={null}
      value={selected}
      onValueChange={(next) => {
        setPicked(next)
        onChange(next?.id)
      }}
      onInputValueChange={(next) => setInputValue(next)}
      itemToStringLabel={(item) => item.name}
      isItemEqualToValue={(item, current) => item.id === current.id}
    >
      <ComboboxInput id={id} placeholder={placeholder} showClear={Boolean(selected)} className="w-full" />
      <ComboboxContent>
        <ComboboxEmpty>Sin resultados</ComboboxEmpty>
        <ComboboxList>
          {(item: CatalogItem) => (
            <ComboboxItem key={item.id} value={item}>
              {item.name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
