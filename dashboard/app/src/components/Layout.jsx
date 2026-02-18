import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Board' },
  { to: '/guards', label: 'Guards' },
  { to: '/commands', label: 'Commands' },
  { to: '/framework', label: 'Framework' },
  { to: '/settings', label: 'Settings' },
  { to: '/changelog', label: 'Changelog' },
]

function Layout() {
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b-2 border-border bg-surface sticky top-0 z-10" style={{ boxShadow: '0 1px 4px rgba(44, 24, 16, 0.06)' }}>
        <div className="max-w-[1440px] mx-auto px-6 py-4 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-3 no-underline">
            <div className="text-2xl">
              🦜
            </div>
            <div>
              <h1 className="text-lg font-semibold text-text-primary">
                Vibe Framework
              </h1>
              <p className="text-xs text-text-muted">v0.1.0</p>
            </div>
          </NavLink>

          <nav className="flex items-center gap-1">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors no-underline ${
                    isActive
                      ? 'bg-accent/10 text-accent font-semibold'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
