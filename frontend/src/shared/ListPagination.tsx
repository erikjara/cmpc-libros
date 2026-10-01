import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { PaginationMeta } from '@/lib/api-types'
import { PAGE_SIZE_OPTIONS } from './pagination'

interface ListPaginationProps {
  meta: PaginationMeta
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
  /** Sustantivo contado en singular y plural, p. ej. ['libro', 'libros']. */
  noun: readonly [string, string]
}

const PAGE_SIZE_ITEMS = PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: String(size) }))

export function ListPagination({ meta, onPageChange, onLimitChange, noun }: ListPaginationProps) {
  const pageSizeId = useId()
  const totalPages = Math.max(meta.totalPages, 1)
  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">
        {meta.total === 1 ? `1 ${noun[0]}` : `${meta.total} ${noun[1]}`} · Página {meta.page} de {totalPages}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={pageSizeId} className="text-muted-foreground">
            Por página
          </Label>
          <Select
            items={PAGE_SIZE_ITEMS}
            value={String(meta.limit)}
            onValueChange={(value) => value && onLimitChange(Number(value))}
          >
            <SelectTrigger id={pageSizeId} size="sm">
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
        </div>
        <div className="flex items-center gap-2">
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
      </div>
    </nav>
  )
}
