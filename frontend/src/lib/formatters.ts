// CLP no usa decimales, pero el contrato admite hasta 2: se muestran solo si existen.
const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 2,
})

const dateTimeFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatCLP(value: number): string {
  return clpFormatter.format(value)
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso))
}
