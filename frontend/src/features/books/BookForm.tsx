import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { CatalogCombobox } from '@/features/catalog/CatalogCombobox'
import type { BookInput, CatalogKind } from '@/lib/api-types'
import { bookFormSchema, emptyBookForm, type BookFormInput, type BookFormOutput } from './book-form.schema'
import { ImagePicker } from './ImagePicker'

interface BookFormProps {
  defaultValues?: BookFormInput
  currentImageUrl?: string | null
  submitLabel: string
  onSubmit: (input: BookInput, image: File | null) => Promise<void>
  onCancel: () => void
}

const CATALOG_FIELDS: ReadonlyArray<{
  name: 'authorName' | 'publisherName' | 'genreName'
  kind: CatalogKind
  label: string
  placeholder: string
}> = [
  { name: 'authorName', kind: 'authors', label: 'Autor', placeholder: 'Busca o escribe un autor' },
  { name: 'publisherName', kind: 'publishers', label: 'Editorial', placeholder: 'Busca o escribe una editorial' },
  { name: 'genreName', kind: 'genres', label: 'Género', placeholder: 'Busca o escribe un género' },
]

export function BookForm({ defaultValues = emptyBookForm, currentImageUrl, submitLabel, onSubmit, onCancel }: BookFormProps) {
  const [image, setImage] = useState<File | null>(null)
  const form = useForm<BookFormInput, unknown, BookFormOutput>({
    resolver: zodResolver(bookFormSchema),
    mode: 'onChange',
    defaultValues,
  })
  const { isValid, isSubmitting } = form.formState

  const submit = form.handleSubmit((values) => onSubmit(values, image))

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6">
      <FieldGroup>
        <Controller
          name="title"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="book-title">Título</FieldLabel>
              <Input {...field} id="book-title" aria-invalid={fieldState.invalid} maxLength={200} />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <div className="grid gap-5 md:grid-cols-3">
          {CATALOG_FIELDS.map((catalogField) => (
            <Controller
              key={catalogField.name}
              name={catalogField.name}
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`book-${catalogField.name}`}>{catalogField.label}</FieldLabel>
                  <CatalogCombobox
                    kind={catalogField.kind}
                    id={`book-${catalogField.name}`}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    invalid={fieldState.invalid}
                    placeholder={catalogField.placeholder}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          ))}
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Controller
            name="price"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="book-price">Precio (CLP)</FieldLabel>
                <Input
                  {...field}
                  id="book-price"
                  inputMode="decimal"
                  aria-invalid={fieldState.invalid}
                  aria-describedby="book-price-help"
                />
                <FieldDescription id="book-price-help">Ej.: 15.990</FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="stock"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="book-stock">Stock</FieldLabel>
                <Input {...field} id="book-stock" inputMode="numeric" aria-invalid={fieldState.invalid} />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </div>
        <ImagePicker currentImageUrl={currentImageUrl} onFileChange={setImage} />
      </FieldGroup>
      <div className="flex gap-2">
        <Button type="submit" disabled={!isValid || isSubmitting}>
          {isSubmitting ? 'Guardando…' : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
