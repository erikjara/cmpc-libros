import { LogOutIcon } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session'
import { useLogout } from '@/features/auth/useLogout'

const NAV_ITEMS = [
  { to: '/books', label: 'Libros' },
  { to: '/trash', label: 'Papelera' },
  { to: '/audit', label: 'Auditoría' },
] as const

const NAV_LINK_CLASS =
  'inline-flex h-8 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none aria-[current=page]:bg-muted aria-[current=page]:text-foreground'

export function AppLayout() {
  const session = useSession()
  const logoutMutation = useLogout()

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        {/* En móvil: marca y cierre de sesión arriba, navegación en una segunda fila con scroll propio. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 sm:h-14 sm:flex-nowrap sm:py-0">
          <Link to="/books" className="font-semibold whitespace-nowrap">
            CMPC-libros
          </Link>
          <nav aria-label="Principal" className="order-last -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 sm:order-none sm:mx-0 sm:w-auto sm:px-0">
            <ul className="flex gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} className={NAV_LINK_CLASS}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {session.data && (
              <span className="hidden max-w-48 truncate text-sm text-muted-foreground md:inline">{session.data.name}</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={logoutMutation.isPending}
              onClick={() => logoutMutation.mutate()}
            >
              <LogOutIcon data-icon="inline-start" />
              <span className="sr-only sm:not-sr-only">Cerrar sesión</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
