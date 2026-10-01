export const DEFAULT_PAGE_SIZE = 10
export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const
/** Página máxima que acepta la API en listados paginados. */
export const MAX_PAGE = 1_000_000

export function parsePositiveInt(raw: string | null, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const value = Number(raw)
  return Number.isInteger(value) && value >= 1 && value <= max ? value : fallback
}
