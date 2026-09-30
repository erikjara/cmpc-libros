import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/api-error'

interface QueryErrorProps {
  error: unknown
  onRetry: () => void
  title?: string
}

export function QueryError({ error, onRetry, title = 'No se pudo cargar la información' }: QueryErrorProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-destructive/40 p-6 text-center">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{getErrorMessage(error)}</p>
      <Button variant="outline" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  )
}
