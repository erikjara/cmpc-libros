import { Skeleton } from '@/components/ui/skeleton'

interface TableSkeletonProps {
  rows?: number
  'data-testid'?: string
}

export function TableSkeleton({ rows = 6, 'data-testid': testId }: TableSkeletonProps) {
  return (
    <div data-testid={testId} role="status" className="flex flex-col gap-2">
      <span className="sr-only">Cargando…</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  )
}
