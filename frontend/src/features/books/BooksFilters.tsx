import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CatalogFilterCombobox } from '@/features/catalog/CatalogFilterCombobox'
import { SearchField } from '@/shared/SearchField'
import { useDebouncedSearch } from '@/shared/useDebouncedSearch'
import type { AvailabilityFilter, BookFilterValues } from './useBookSearchParams'

export { SEARCH_DEBOUNCE_MS } from '@/shared/useDebouncedSearch'
const ALL = 'all'

const AVAILABILITY_ITEMS = [
  { value: ALL, label: 'Todos' },
  { value: 'true', label: 'Disponibles' },
  { value: 'false', label: 'Agotados' },
]

interface BooksFiltersProps {
  values: BookFilterValues
  onChange: (patch: Partial<BookFilterValues>) => void
  onClear: () => void
  hasActiveFilters: boolean
}

export function BooksFilters({ values, onChange, onClear, hasActiveFilters }: BooksFiltersProps) {
  const [searchText, setSearchText] = useDebouncedSearch(values.search, (search) => onChange({ search }))
  // 1 columna en móvil, 2 desde sm y los 5 filtros en una fila desde lg.
  return (
    <div className="grid grid-cols-1 gap-3 *:min-w-0 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
      <SearchField id="books-search" value={searchText} onChange={setSearchText} className="sm:col-span-2 lg:col-span-1" />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="books-genre">Género</Label>
        <CatalogFilterCombobox
          kind="genres"
          id="books-genre"
          placeholder="Todos los géneros"
          value={values.genreId}
          onChange={(genreId) => onChange({ genreId })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="books-author">Autor</Label>
        <CatalogFilterCombobox
          kind="authors"
          id="books-author"
          placeholder="Todos los autores"
          value={values.authorId}
          onChange={(authorId) => onChange({ authorId })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="books-publisher">Editorial</Label>
        <CatalogFilterCombobox
          kind="publishers"
          id="books-publisher"
          placeholder="Todas las editoriales"
          value={values.publisherId}
          onChange={(publisherId) => onChange({ publisherId })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="books-available">Disponibilidad</Label>
        <Select
          items={AVAILABILITY_ITEMS}
          value={values.available ?? ALL}
          onValueChange={(value) =>
            onChange({ available: value === 'true' || value === 'false' ? (value as AvailabilityFilter) : undefined })
          }
        >
          <SelectTrigger id="books-available" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AVAILABILITY_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="sm:col-span-2 lg:col-span-5">
        <Button
          variant="ghost"
          size="sm"
          disabled={!hasActiveFilters && !searchText}
          onClick={() => {
            setSearchText('')
            onClear()
          }}
        >
          Limpiar filtros
        </Button>
      </div>
    </div>
  )
}
