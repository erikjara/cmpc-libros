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

const SORT_LABELS = { asc: 'ascendente', desc: 'descendente' } as const

interface BooksTableProps {
  books: Book[]
  total: number
  page: number
  limit: number
  sorting: SortingState
  onSortingChange: (sorting: SortingState) => void
}

export function BooksTable({ books, total, page, limit, sorting, onSortingChange }: BooksTableProps) {
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
    // Cada clic agrega la columna al orden existente: asc → desc → sin orden.
    isMultiSortEvent: () => true,
    sortDescFirst: false,
    enableSortingRemoval: true,
    maxMultiSortColCount: 7,
  })

  return (
    <Table>
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
                  >
                    <table.FlexRender header={header} />
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
              <TableCell key={cell.id}>
                <table.FlexRender cell={cell} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
