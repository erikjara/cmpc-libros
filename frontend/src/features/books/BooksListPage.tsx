import { DownloadIcon, PlusIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/shared/EmptyState'
import { QueryError } from '@/shared/QueryError'
import { buildExportUrl } from './books.api'
import { useBooksQuery } from './books.queries'
import { BooksFilters } from './BooksFilters'
import { BooksPagination } from './BooksPagination'
import { BooksTable } from './BooksTable'
import { useBookSearchParams } from './useBookSearchParams'

function BooksTableSkeleton() {
  return (
    <div data-testid="books-skeleton" className="flex flex-col gap-2">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  )
}

export function BooksListPage() {
  const { state, query, filters, setPage, setLimit, setFilters, setSorting, clearFilters, hasActiveFilters } =
    useBookSearchParams()
  const booksQuery = useBooksQuery(query)
  const result = booksQuery.data

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Libros</h1>
        <div className="flex gap-2">
          <a href={buildExportUrl(filters)} download className={buttonVariants({ variant: 'outline' })}>
            <DownloadIcon data-icon="inline-start" />
            Exportar CSV
          </a>
          <Link to="/books/new" className={buttonVariants()}>
            <PlusIcon data-icon="inline-start" />
            Nuevo libro
          </Link>
        </div>
      </div>

      <BooksFilters values={state} onChange={setFilters} onClear={clearFilters} hasActiveFilters={hasActiveFilters} />

      {booksQuery.isPending && <BooksTableSkeleton />}

      {booksQuery.isError && !result && (
        <QueryError error={booksQuery.error} onRetry={() => void booksQuery.refetch()} title="No se pudieron cargar los libros" />
      )}

      {result && result.data.length === 0 && (
        <EmptyState
          title="No se encontraron libros"
          description={hasActiveFilters ? 'Prueba con otros filtros o términos de búsqueda.' : 'Aún no hay libros registrados.'}
          action={
            hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            ) : undefined
          }
        />
      )}

      {result && result.data.length > 0 && (
        <div className={booksQuery.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined} aria-busy={booksQuery.isFetching}>
          <BooksTable
            books={result.data}
            total={result.meta.total}
            page={state.page}
            limit={state.limit}
            sorting={state.sorting}
            onSortingChange={setSorting}
          />
        </div>
      )}

      {result && result.meta.total > 0 && (
        <BooksPagination meta={result.meta} onPageChange={setPage} onLimitChange={setLimit} />
      )}
    </section>
  )
}
