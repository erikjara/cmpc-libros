import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { PaginationMeta } from '@/lib/api-types'
import { PAGE_SIZE_OPTIONS } from './useBookSearchParams'

interface BooksPaginationProps {
  meta: PaginationMeta
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
}

const PAGE_SIZE_ITEMS = PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: String(size) }))

export function BooksPagination({ meta, onPageChange, onLimitChange }: BooksPaginationProps) {
  const totalPages = Math.max(meta.totalPages, 1)
  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">
        {meta.total === 1 ? '1 libro' : `${meta.total} libros`} · Página {meta.page} de {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Label htmlFor="books-page-size" className="text-muted-foreground">
          Por página
        </Label>
        <Select
          items={PAGE_SIZE_ITEMS}
          value={String(meta.limit)}
          onValueChange={(value) => value && onLimitChange(Number(value))}
        >
          <SelectTrigger id="books-page-size" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(Math.min(meta.page - 1, totalPages))}
        >
          <ChevronLeftIcon data-icon="inline-start" />
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page >= totalPages}
          onClick={() => onPageChange(meta.page + 1)}
        >
          Siguiente
          <ChevronRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </nav>
  )
}
