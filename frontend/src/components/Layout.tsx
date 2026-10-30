import { Plus } from 'lucide-react'
import { Link, NavLink, Outlet, useMatch } from 'react-router-dom'

import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Reviews' },
  { to: '/documents', label: 'Documents' },
]

export function Layout() {
  const fullWidth = useMatch('/reviews/:id')
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="flex h-14 items-center gap-8 px-6">
          <Link to="/"><Logo /></Link>
          <nav className="flex gap-6">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end
                className={({ isActive }) =>
                  cn(
                    'relative py-4 text-sm text-muted-foreground transition-colors hover:text-ink',
                    isActive && 'text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-brand',
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto">
            <Button asChild size="sm" className="rounded-full px-4">
              <Link to="/new"><Plus /> New review</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className={cn('px-6 py-10', !fullWidth && 'mx-auto max-w-6xl')}>
        <Outlet />
      </main>
    </div>
  )
}
