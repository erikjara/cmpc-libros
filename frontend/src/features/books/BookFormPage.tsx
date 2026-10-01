import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError, getErrorMessage } from '@/lib/api-error'
import type { Book } from '@/lib/api-types'
import { NotFoundPage } from '@/shared/NotFoundPage'
import { QueryError } from '@/shared/QueryError'
import { bookToFormValues } from './book-form.schema'
import { useFreshBookQuery, useSaveBook, type SaveBookVariables } from './books.queries'
import { BookForm } from './BookForm'

function useSubmitBook(onConflict?: (message: string) => void) {
  const navigate = useNavigate()
  const saveBook = useSaveBook()

  return async (variables: SaveBookVariables) => {
    try {
      const { book, imageError } = await saveBook.mutateAsync(variables)
      if (onConflict && imageError?.status === 412) {
        // El PATCH ya se aplicó; la portada se rechazó por un cambio ajeno posterior.
        onConflict(`Los datos del libro se guardaron, pero la portada no: ${imageError.message}`)
        return
      }
      if (imageError) {
        toast.error(`El libro se guardó, pero no se pudo subir la imagen: ${imageError.message}`)
      } else {
        toast.success(variables.id ? 'Libro actualizado' : 'Libro creado')
      }
      await navigate(`/books/${book.id}`)
    } catch (error) {
      if (onConflict && error instanceof ApiError && error.status === 412) {
        onConflict(error.message)
        return
      }
      toast.error(getErrorMessage(error))
    }
  }
}

function CreateBook() {
  const navigate = useNavigate()
  const submit = useSubmitBook()
  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Nuevo libro</h1>
      <BookForm
        submitLabel="Crear libro"
        onSubmit={(input, image) => submit({ input, image })}
        onCancel={() => void navigate('/books')}
      />
    </section>
  )
}

/** Versión del libro que pobló el formulario; `revision` reinicia el formulario al cambiarla. */
interface EditBaseline {
  book: Book
  revision: number
}

// Bloqueo optimista: el If-Match es siempre el updatedAt de `baseline`, los datos que el usuario ve
// en el formulario, nunca el de una lectura posterior. Al montar se espera la versión del servidor
// (no la caché) y, mientras no haya cambios locales, el formulario adopta las versiones nuevas. Con
// cambios locales no se pisa lo escrito y se conserva la versión original, así que un cambio ajeno
// termina en 412. Tras un 412 no se ofrece "guardar igual": el envío queda bloqueado hasta que el
// usuario recargue la versión actual (descartando lo local) o cancele, una decisión explícita.
function EditBook({ id }: { id: string }) {
  const navigate = useNavigate()
  const bookQuery = useFreshBookQuery(id)
  const [baseline, setBaseline] = useState<EditBaseline | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [conflict, setConflict] = useState<string | null>(null)
  const submit = useSubmitBook(setConflict)

  const serverBook = bookQuery.isFetchedAfterMount && bookQuery.isSuccess ? bookQuery.data : undefined
  if (
    serverBook &&
    conflict === null &&
    (!baseline || (!hasChanges && serverBook.updatedAt !== baseline.book.updatedAt))
  ) {
    setBaseline({ book: serverBook, revision: (baseline?.revision ?? 0) + 1 })
  }

  const reloadCurrentVersion = async () => {
    const result = await bookQuery.refetch()
    if (!result.isSuccess) {
      toast.error(getErrorMessage(result.error))
      return
    }
    const fresh = result.data
    setBaseline((current) => ({ book: fresh, revision: (current?.revision ?? 0) + 1 }))
    setHasChanges(false)
    setConflict(null)
  }

  if (!baseline) {
    if (bookQuery.isError) {
      const status = bookQuery.error instanceof ApiError ? bookQuery.error.status : undefined
      if (status === 404 || status === 400) {
        return <NotFoundPage title="Libro no encontrado" description="El libro no existe o fue eliminado." />
      }
      return <QueryError error={bookQuery.error} onRetry={() => void bookQuery.refetch()} title="No se pudo cargar el libro" />
    }
    return <Skeleton data-testid="book-form-skeleton" className="h-96 w-full max-w-3xl" />
  }

  const { book } = baseline
  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Editar libro</h1>
      {conflict !== null && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-destructive/40 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm">{conflict}</p>
          <Button variant="outline" onClick={() => void reloadCurrentVersion()}>
            Recargar versión actual
          </Button>
        </div>
      )}
      <BookForm
        key={baseline.revision}
        defaultValues={bookToFormValues(book)}
        currentImageUrl={book.imageUrl}
        submitLabel="Guardar cambios"
        requireChanges
        submitBlocked={conflict !== null}
        onChangesStatus={setHasChanges}
        onSubmit={(_input, image, changes) => submit({ id, expectedUpdatedAt: book.updatedAt, changes, image })}
        onCancel={() => void navigate(`/books/${book.id}`)}
      />
    </section>
  )
}

export function BookFormPage() {
  const { id } = useParams()
  return id ? <EditBook id={id} /> : <CreateBook />
}
