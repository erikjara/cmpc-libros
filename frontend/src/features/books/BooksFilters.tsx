import { SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCatalogOptions } from '@/features/catalog/catalog.queries'
import { CatalogFilterCombobox } from '@/features/catalog/CatalogFilterCombobox'
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
  const { data: genres = [] } = useCatalogOptions('genres', '')

  const genreItems = [{ value: ALL, label: 'Todos los géneros' }, ...genres.map((g) => ({ value: g.id, label: g.name }))]

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6 lg:items-end">
      <div className="flex flex-col gap-1.5 lg:col-span-2">
        <Label htmlFor="books-search">Buscar</Label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" aria-hidden />
          <Input
            id="books-search"
            type="search"
            className="pl-8"
            placeholder="Título o autor"
            maxLength={100}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="books-genre">Género</Label>
        <Select
          items={genreItems}
          value={values.genreId ?? ALL}
          onValueChange={(value) => onChange({ genreId: value && value !== ALL ? value : undefined })}
        >
          <SelectTrigger id="books-genre" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {genreItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      <div className="lg:col-span-6">
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
