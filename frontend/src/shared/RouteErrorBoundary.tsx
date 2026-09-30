import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { buttonVariants } from '@/components/ui/button'
import { ApiError } from '@/lib/api-error'
import { NotFoundPage } from './NotFoundPage'

interface RouteErrorBoundaryProps {
  /** Solo fuera del layout (que ya aporta el <main>) se renderiza como <main>. */
  fullPage?: boolean
}

export function RouteErrorBoundary({ fullPage = false }: RouteErrorBoundaryProps) {
  const error = useRouteError()
  const Container = fullPage ? 'main' : 'section'

  if (
    (isRouteErrorResponse(error) && error.status === 404) ||
    (error instanceof ApiError && error.status === 404)
  ) {
    return <NotFoundPage fullPage={fullPage} />
  }

  const message = error instanceof ApiError ? error.message : 'Ocurrió un error inesperado.'

  return (
    <Container className="mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center">
      <div role="alert" className="flex flex-col items-center gap-4">
        <h1 className="text-xl font-semibold">Algo salió mal</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <div className="flex gap-2">
        <button type="button" className={buttonVariants({ variant: 'outline' })} onClick={() => window.location.reload()}>
          Recargar
        </button>
        <Link to="/books" className={buttonVariants()}>
          Ir al listado
        </Link>
      </div>
    </Container>
  )
}
