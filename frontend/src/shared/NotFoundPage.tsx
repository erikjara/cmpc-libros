import { Link } from 'react-router'
import { buttonVariants } from '@/components/ui/button'

interface NotFoundPageProps {
  title?: string
  description?: string
}

export function NotFoundPage({
  title = 'Página no encontrada',
  description = 'La dirección que buscas no existe o fue movida.',
}: NotFoundPageProps) {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center">
      <p className="text-5xl font-semibold text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
      <Link to="/books" className={buttonVariants()}>
        Volver al listado
      </Link>
    </main>
  )
}
