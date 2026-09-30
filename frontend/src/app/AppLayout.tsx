import { LogOutIcon } from 'lucide-react'
import { Link, Outlet } from 'react-router'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session'
import { useLogout } from '@/features/auth/useLogout'

export function AppLayout() {
  const session = useSession()
  const logoutMutation = useLogout()

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/books" className="font-semibold">
            CMPC-libros
          </Link>
          <div className="flex items-center gap-3">
            {session.data && (
              <span className="hidden text-sm text-muted-foreground sm:inline">{session.data.name}</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={logoutMutation.isPending}
              onClick={() => logoutMutation.mutate()}
            >
              <LogOutIcon data-icon="inline-start" />
              Cerrar sesión
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
