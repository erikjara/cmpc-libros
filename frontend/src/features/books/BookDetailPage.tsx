import { ArrowLeftIcon, BookIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError, getErrorMessage } from '@/lib/api-error'
import { formatCLP, formatDateTime } from '@/lib/formatters'
import { ConfirmDialog } from '@/shared/ConfirmDialog'
import { NotFoundPage } from '@/shared/NotFoundPage'
import { QueryError } from '@/shared/QueryError'
import { AvailabilityBadge } from './AvailabilityBadge'
import { useBookQuery, useDeleteBook } from './books.queries'

export function BookDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const bookQuery = useBookQuery(id)
  const deleteMutation = useDeleteBook()
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (bookQuery.isPending) {
    return (
      <div data-testid="book-skeleton" role="status" className="grid gap-6 md:grid-cols-[240px_1fr]">
        <span className="sr-only">Cargando…</span>
        <Skeleton className="aspect-[2/3] w-full" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      </div>
    )
  }

  if (bookQuery.isError) {
    const status = bookQuery.error instanceof ApiError ? bookQuery.error.status : undefined
    if (status === 404 || status === 400) {
      return <NotFoundPage title="Libro no encontrado" description="El libro no existe o fue eliminado." />
    }
    return <QueryError error={bookQuery.error} onRetry={() => void bookQuery.refetch()} title="No se pudo cargar el libro" />
  }

  const book = bookQuery.data

  const handleDelete = () => {
    deleteMutation.mutate(book.id, {
      onSuccess: async () => {
        setConfirmOpen(false)
        toast.success('Libro eliminado')
        await navigate('/books', { replace: true })
      },
      onError: (error) => {
        toast.error(getErrorMessage(error))
      },
    })
  }

  return (
    <article className="flex flex-col gap-6">
      <Link to="/books" className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'w-fit' })}>
        <ArrowLeftIcon data-icon="inline-start" />
        Volver al listado
      </Link>
      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        {book.imageUrl ? (
          <img src={book.imageUrl} alt={`Portada de ${book.title}`} className="aspect-[2/3] w-full rounded-lg object-cover" />
        ) : (
          <div
            role="img"
            aria-label="Sin portada"
            className="flex aspect-[2/3] w-full items-center justify-center rounded-lg bg-muted text-muted-foreground"
          >
            <BookIcon className="size-12" aria-hidden />
          </div>
        )}
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">{book.title}</h1>
                <p className="text-muted-foreground">{book.author.name}</p>
              </div>
              <AvailabilityBadge stock={book.stock} />
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Editorial</dt>
              <dd>{book.publisher.name}</dd>
              <dt className="text-muted-foreground">Género</dt>
              <dd>{book.genre.name}</dd>
              <dt className="text-muted-foreground">Precio</dt>
              <dd>{formatCLP(book.price)}</dd>
              <dt className="text-muted-foreground">Stock</dt>
              <dd>{book.stock}</dd>
              <dt className="text-muted-foreground">Creado</dt>
              <dd>{formatDateTime(book.createdAt)}</dd>
              <dt className="text-muted-foreground">Actualizado</dt>
              <dd>{formatDateTime(book.updatedAt)}</dd>
            </dl>
            <div className="flex gap-2">
              <Link to={`/books/${book.id}/edit`} className={buttonVariants()}>
                <PencilIcon data-icon="inline-start" />
                Editar
              </Link>
              <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
                <Trash2Icon data-icon="inline-start" />
                Eliminar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="¿Eliminar este libro?"
        description={`"${book.title}" dejará de aparecer en el inventario.`}
        confirmLabel="Eliminar"
        pending={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </article>
  )
}
