import { DownloadIcon, PlusIcon } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/api-error'
import { EmptyState } from '@/shared/EmptyState'
import { ListPagination } from '@/shared/ListPagination'
import { QueryError } from '@/shared/QueryError'
import { buildExportUrl } from './books.api'
import { useBooksQuery } from './books.queries'
import { BooksFilters } from './BooksFilters'
import { BooksTable } from './BooksTable'
import { useBookSearchParams } from './useBookSearchParams'

const BOOK_NOUN = ['libro', 'libros'] as const

function BooksTableSkeleton() {
  return (
    <div data-testid="books-skeleton" role="status" className="flex flex-col gap-2">
      <span className="sr-only">Cargando…</span>
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
  // Página fuera de rango (p. ej. tras eliminar el último libro de la última página): el servidor
  // responde data vacía con el total real, así que se reemplaza la URL por la última página.
  const lastPage = result && result.data.length === 0 && result.meta.total > 0 ? result.meta.totalPages : null
  const redirectPage = booksQuery.isPlaceholderData ? null : lastPage

  useEffect(() => {
    if (redirectPage !== null) setPage(redirectPage, { replace: true })
  }, [redirectPage, setPage])

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

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {result && redirectPage === null
          ? `${result.meta.total} ${result.meta.total === 1 ? 'libro encontrado' : 'libros encontrados'}`
          : ''}
      </p>

      <BooksFilters values={state} onChange={setFilters} onClear={clearFilters} hasActiveFilters={hasActiveFilters} />

      {(booksQuery.isPending || lastPage !== null) && <BooksTableSkeleton />}

      {booksQuery.isError && result && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 px-4 py-3 text-sm"
        >
          <p>
            <span className="font-medium">No se pudieron actualizar los libros.</span>{' '}
            <span className="text-muted-foreground">{getErrorMessage(booksQuery.error)}</span>
          </p>
          <Button variant="outline" size="sm" onClick={() => void booksQuery.refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {booksQuery.isError && !result && (
        <QueryError error={booksQuery.error} onRetry={() => void booksQuery.refetch()} title="No se pudieron cargar los libros" />
      )}

      {result && result.meta.total === 0 && (
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
        <ListPagination meta={result.meta} onPageChange={setPage} onLimitChange={setLimit} noun={BOOK_NOUN} />
      )}
    </section>
  )
}
