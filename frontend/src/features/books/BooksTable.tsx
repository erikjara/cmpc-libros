import {
  createColumnHelper,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type SortingState,
  type Updater,
} from '@tanstack/react-table'
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Book } from '@/lib/api-types'
import { formatCLP } from '@/lib/formatters'
import { AvailabilityBadge } from './AvailabilityBadge'

const features = tableFeatures({ rowSortingFeature, rowPaginationFeature })
const columnHelper = createColumnHelper<typeof features, Book>()

const columns = columnHelper.columns([
  columnHelper.accessor('title', {
    header: 'Título',
    cell: (info) => (
      <Link to={`/books/${info.row.original.id}`} className="font-medium hover:underline">
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor((book) => book.author.name, { id: 'author', header: 'Autor' }),
  columnHelper.accessor((book) => book.publisher.name, { id: 'publisher', header: 'Editorial' }),
  columnHelper.accessor((book) => book.genre.name, { id: 'genre', header: 'Género' }),
  columnHelper.accessor('price', {
    header: 'Precio',
    cell: (info) => formatCLP(info.getValue()),
  }),
  columnHelper.accessor('stock', {
    header: 'Disponibilidad',
    cell: (info) => <AvailabilityBadge stock={info.getValue()} />,
  }),
])

// Anchos fijos por columna (table-layout: fixed): el ancho no depende del contenido de la página,
// así que ordenar o paginar no desplaza las columnas.
const COLUMN_WIDTHS: Record<string, string> = {
  title: '30%',
  author: '18%',
  publisher: '14%',
  genre: '13%',
  price: '11%',
  stock: '14%',
}

const SORT_LABELS = { asc: 'ascendente', desc: 'descendente' } as const
const MULTI_SORT_HINT = 'Mayús + clic para ordenar por varias columnas'

function isShiftClick(event: unknown): boolean {
  return typeof event === 'object' && event !== null && 'shiftKey' in event && event.shiftKey === true
}

interface BooksTableProps {
  books: Book[]
  total: number
  page: number
  limit: number
  sorting: SortingState
  onSortingChange: (sorting: SortingState) => void
}

export function BooksTable({ books, total, page, limit, sorting, onSortingChange }: BooksTableProps) {
  const hintId = useId()
  const table = useTable({
    features,
    columns,
    data: books,
    rowCount: total,
    getRowId: (book) => book.id,
    state: { sorting, pagination: { pageIndex: page - 1, pageSize: limit } },
    onSortingChange: (updater: Updater<SortingState>) =>
      onSortingChange(typeof updater === 'function' ? updater(sorting) : updater),
    manualSorting: true,
    manualPagination: true,
    enableMultiSort: true,
    // Clic: ordena solo por esa columna. Mayús + clic: la agrega o cicla dentro del orden múltiple.
    // En ambos casos el ciclo es asc → desc → sin orden.
    isMultiSortEvent: isShiftClick,
    sortDescFirst: false,
    enableSortingRemoval: true,
    maxMultiSortColCount: 7,
  })

  return (
    <div className="flex flex-col gap-2">
      <Table className="min-w-[760px] table-fixed">
        <colgroup>
          {table.getAllLeafColumns().map((column) => (
            <col key={column.id} style={{ width: COLUMN_WIDTHS[column.id] }} />
          ))}
        </colgroup>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const direction = header.column.getIsSorted()
                const priority = header.column.getSortIndex() + 1
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={direction ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                      onClick={header.column.getToggleSortingHandler()}
                      title={MULTI_SORT_HINT}
                      aria-describedby={hintId}
                    >
                      <table.FlexRender header={header} />
                      {/* Espacio fijo para el indicador: activarlo no ensancha el encabezado. */}
                      <span className="inline-flex w-9 shrink-0 items-center gap-1">
                        {direction === 'asc' && <ArrowUpIcon className="size-3.5" aria-hidden />}
                        {direction === 'desc' && <ArrowDownIcon className="size-3.5" aria-hidden />}
                        {!direction && <ArrowUpDownIcon className="size-3.5 opacity-40" aria-hidden />}
                        {direction && (
                          <Badge
                            variant="outline"
                            className="h-4 px-1 text-[10px]"
                            aria-label={`Prioridad ${priority}, ${SORT_LABELS[direction]}`}
                          >
                            {priority}
                          </Badge>
                        )}
                      </span>
                    </button>
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id} className="whitespace-normal break-words">
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p id={hintId} className="text-xs text-muted-foreground">
        {MULTI_SORT_HINT}
      </p>
    </div>
  )
}
