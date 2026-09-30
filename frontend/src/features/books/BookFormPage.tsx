import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError, getErrorMessage } from '@/lib/api-error'
import type { BookInput } from '@/lib/api-types'
import { NotFoundPage } from '@/shared/NotFoundPage'
import { QueryError } from '@/shared/QueryError'
import { bookToFormValues } from './book-form.schema'
import { useBookQuery, useSaveBook } from './books.queries'
import { BookForm } from './BookForm'

function useSubmitBook(id?: string) {
  const navigate = useNavigate()
  const saveBook = useSaveBook()

  return async (input: BookInput, image: File | null) => {
    try {
      const { book, imageError } = await saveBook.mutateAsync({ id, input, image })
      if (imageError) {
        toast.error(`El libro se guardó, pero no se pudo subir la imagen: ${imageError.message}`)
      } else {
        toast.success(id ? 'Libro actualizado' : 'Libro creado')
      }
      await navigate(`/books/${book.id}`)
    } catch (error) {
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
      <BookForm submitLabel="Crear libro" onSubmit={submit} onCancel={() => void navigate('/books')} />
    </section>
  )
}

function EditBook({ id }: { id: string }) {
  const navigate = useNavigate()
  const bookQuery = useBookQuery(id)
  const submit = useSubmitBook(id)

  if (bookQuery.isPending) {
    return <Skeleton data-testid="book-form-skeleton" className="h-96 w-full max-w-3xl" />
  }
  if (bookQuery.isError) {
    const status = bookQuery.error instanceof ApiError ? bookQuery.error.status : undefined
    if (status === 404 || status === 400) {
      return <NotFoundPage title="Libro no encontrado" description="El libro no existe o fue eliminado." />
    }
    return <QueryError error={bookQuery.error} onRetry={() => void bookQuery.refetch()} title="No se pudo cargar el libro" />
  }

  const book = bookQuery.data
  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Editar libro</h1>
      <BookForm
        key={book.id}
        defaultValues={bookToFormValues(book)}
        currentImageUrl={book.imageUrl}
        submitLabel="Guardar cambios"
        onSubmit={submit}
        onCancel={() => void navigate(`/books/${book.id}`)}
      />
    </section>
  )
}

export function BookFormPage() {
  const { id } = useParams()
  return id ? <EditBook id={id} /> : <CreateBook />
}
