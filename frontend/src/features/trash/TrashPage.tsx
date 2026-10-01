import { ArchiveRestoreIcon } from 'lucide-react'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useRestoreBook, useTrashQuery } from '@/features/books/books.queries'
import { getErrorMessage } from '@/lib/api-error'
import type { TrashedBook } from '@/lib/api-types'
import { formatDateTime } from '@/lib/formatters'
import { EmptyState } from '@/shared/EmptyState'
import { ListPagination } from '@/shared/ListPagination'
import { QueryError } from '@/shared/QueryError'
import { SearchField } from '@/shared/SearchField'
import { TableSkeleton } from '@/shared/TableSkeleton'
import { useDebouncedSearch } from '@/shared/useDebouncedSearch'
import { usePaginatedSearchParams } from '@/shared/usePaginatedSearchParams'

const NOUN = ['libro eliminado', 'libros eliminados'] as const
const MAX_SEARCH_LENGTH = 100

interface TrashTableProps {
  books: TrashedBook[]
  restoringId: string | null
  onRestore: (book: TrashedBook) => void
}

function TrashTable({ books, restoringId, onRestore }: TrashTableProps) {
  return (
    <Table className="min-w-[720px] table-fixed">
      <colgroup>
        <col style={{ width: '32%' }} />
        <col style={{ width: '20%' }} />
        <col style={{ width: '16%' }} />
        <col style={{ width: '17%' }} />
        <col style={{ width: '15%' }} />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>Título</TableHead>
          <TableHead>Autor</TableHead>
          <TableHead>Editorial</TableHead>
          <TableHead>Eliminado el</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {books.map((book) => (
          <TableRow key={book.id}>
            <TableCell className="font-medium whitespace-normal break-words">{book.title}</TableCell>
            <TableCell className="whitespace-normal break-words">{book.author.name}</TableCell>
            <TableCell className="whitespace-normal break-words">{book.publisher.name}</TableCell>
            <TableCell>
              <time dateTime={book.deletedAt}>{formatDateTime(book.deletedAt)}</time>
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="outline"
                size="sm"
                aria-label={`Restaurar ${book.title}`}
                disabled={restoringId === book.id}
                onClick={() => onRestore(book)}
              >
                <ArchiveRestoreIcon data-icon="inline-start" />
                Restaurar
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function TrashPage() {
  const { searchParams, page, limit, setPage, setLimit, setParam } = usePaginatedSearchParams()
  const search = (searchParams.get('search') ?? '').slice(0, MAX_SEARCH_LENGTH)
  const [searchText, setSearchText] = useDebouncedSearch(search, (value) => setParam('search', value))
  const trimmedSearch = search.trim()
  const trashQuery = useTrashQuery({ page, limit, ...(trimmedSearch ? { search: trimmedSearch } : {}) })
  const restoreMutation = useRestoreBook()
  const result = trashQuery.data
  // Al restaurar el último libro de la última página, esa página queda fuera de rango.
  const lastPage = result && result.data.length === 0 && result.meta.total > 0 ? result.meta.totalPages : null
  const redirectPage = trashQuery.isPlaceholderData ? null : lastPage

  useEffect(() => {
    if (redirectPage !== null) setPage(redirectPage, { replace: true })
  }, [redirectPage, setPage])

  const handleRestore = (book: TrashedBook) => {
    restoreMutation.mutateAsync(book.id).then(
      () => toast.success('Libro restaurado'),
      (error: unknown) => toast.error(getErrorMessage(error)),
    )
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Papelera</h1>
        <p className="text-sm text-muted-foreground">Libros eliminados. Puedes restaurarlos al inventario.</p>
      </div>

      <SearchField id="trash-search" value={searchText} onChange={setSearchText} className="w-full sm:max-w-sm" />

      {(trashQuery.isPending || lastPage !== null) && <TableSkeleton />}

      {trashQuery.isError && (
        <QueryError error={trashQuery.error} onRetry={() => void trashQuery.refetch()} title="No se pudo cargar la papelera" />
      )}

      {result && result.meta.total === 0 && (
        <EmptyState
          title={trimmedSearch ? 'No se encontraron libros eliminados' : 'La papelera está vacía'}
          description={trimmedSearch ? 'Prueba con otros términos de búsqueda.' : 'Los libros que elimines aparecerán aquí.'}
        />
      )}

      {result && result.data.length > 0 && (
        <div className={trashQuery.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined} aria-busy={trashQuery.isFetching}>
          <TrashTable
            books={result.data}
            restoringId={restoreMutation.isPending ? (restoreMutation.variables ?? null) : null}
            onRestore={handleRestore}
          />
        </div>
      )}

      {result && result.meta.total > 0 && (
        <ListPagination meta={result.meta} onPageChange={setPage} onLimitChange={setLimit} noun={NOUN} />
      )}
    </section>
  )
}
