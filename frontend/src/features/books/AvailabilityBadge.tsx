import { Badge } from '@/components/ui/badge'

export function AvailabilityBadge({ stock }: { stock: number }) {
  return stock > 0 ? (
    <Badge variant="secondary">Disponible ({stock})</Badge>
  ) : (
    <Badge variant="destructive">Agotado</Badge>
  )
}
