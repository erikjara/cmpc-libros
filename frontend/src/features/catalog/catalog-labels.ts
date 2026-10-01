import type { CatalogKind } from '@/lib/api-types'

// Nombres accesibles de los botones de los combobox de catálogo (solo muestran un ícono).
export const CATALOG_TRIGGER_LABELS: Record<CatalogKind, string> = {
  authors: 'Mostrar autores',
  publishers: 'Mostrar editoriales',
  genres: 'Mostrar géneros',
}

export const CATALOG_CLEAR_LABELS: Record<CatalogKind, string> = {
  authors: 'Quitar autor',
  publishers: 'Quitar editorial',
  genres: 'Quitar género',
}
