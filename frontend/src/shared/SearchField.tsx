import { SearchIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SearchFieldProps {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchField({ id, value, onChange, placeholder = 'Título o autor', className }: SearchFieldProps) {
  return (
    <div className={['flex flex-col gap-1.5', className].filter(Boolean).join(' ')}>
      <Label htmlFor={id}>Buscar</Label>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" aria-hidden />
        <Input
          id={id}
          type="search"
          className="pl-8"
          placeholder={placeholder}
          maxLength={100}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  )
}
