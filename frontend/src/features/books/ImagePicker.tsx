import { ImageIcon, XIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ALLOWED_IMAGE_TYPES, validateImage } from './image-validation'

interface ImagePickerProps {
  currentImageUrl?: string | null
  onFileChange: (file: File | null) => void
}

export function ImagePicker({ currentImageUrl = null, onFileChange }: ImagePickerProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Libera la URL de la vista previa al desmontar para no retener el archivo en memoria.
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    },
    [],
  )

  const selectFile = (file: File | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = file ? URL.createObjectURL(file) : null
    setPreviewUrl(previewRef.current)
    onFileChange(file)
  }

  const shownUrl = previewUrl ?? currentImageUrl

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-medium">
        Portada
      </label>
      <div className="flex items-start gap-4">
        {shownUrl ? (
          <img src={shownUrl} alt="Vista previa de la portada" className="h-36 w-24 shrink-0 rounded-md object-cover" />
        ) : (
          <div className="flex h-36 w-24 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <ImageIcon className="size-8" aria-hidden />
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(',')}
            aria-invalid={Boolean(error)}
            aria-describedby={`${inputId}-hint`}
            className="max-w-full text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1"
            onChange={(event) => {
              const selected = event.target.files?.[0]
              if (!selected) return
              const validationError = validateImage(selected)
              setError(validationError)
              if (validationError) {
                event.target.value = ''
                // El input ya no conserva el archivo anterior: se descarta también la selección.
                if (previewRef.current) selectFile(null)
                return
              }
              selectFile(selected)
            }}
          />
          <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
            JPG, PNG o WebP. Máximo 2 MB.
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {previewUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() => {
                selectFile(null)
                if (inputRef.current) inputRef.current.value = ''
              }}
            >
              <XIcon data-icon="inline-start" />
              Quitar imagen seleccionada
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
