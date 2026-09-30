export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024

// Misma regla que el backend (POST /books/:id/image): jpeg/png/webp y ≤ 2 MB.
export function validateImage(file: File): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'Formato no permitido. Usa JPG, PNG o WebP.'
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'La imagen supera el máximo de 2 MB.'
  }
  return null
}
