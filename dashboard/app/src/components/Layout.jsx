import { NavLink, Outlet, useLocation } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Cycles', matchPaths: ['/', '/cycle'] },
  { to: '/guards', label: 'Guards' },
  { to: '/settings', label: 'Settings' },
  { to: '/changelog', label: 'Changelog' },
]

function Layout() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="border-b border-border bg-surface-alt sticky top-0 z-10" style={{ boxShadow: '0 1px 4px rgba(0, 0, 0, 0.2)' }}>
        <div className="px-6 py-4 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-3 no-underline">
            <img src="/mascot/parrot.png" alt="Vibe" className="w-8 h-8 object-contain" />
            <div>
              <h1 className="text-lg font-semibold text-text-primary">
                Vibe
              </h1>
              <p className="text-xs text-text-muted">v0.1.0</p>
            </div>
          </NavLink>

          <nav className="flex items-center gap-1">
            {navItems.map(({ to, label, matchPaths }) => {
              const active = matchPaths
                ? matchPaths.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))
                : location.pathname === to

              return (
                <NavLink
                  key={to}
                  to={to}
                  className={
                    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors no-underline ${
                      active
                        ? 'bg-accent/10 text-accent font-semibold'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                    }`
                  }
                >
                  {label}
                </NavLink>
              )
            })}
            <a
              href="https://github.com/prashishh/vibe"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors no-underline text-text-secondary hover:text-text-primary hover:bg-surface-hover"
            >
              Framework
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        <Outlet />
        <div className="fixed bottom-4 left-4 flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity pointer-events-none select-none z-10">
          <img src="/mascot/working.png" alt="" className="w-8 h-8 object-contain" />
          <span className="text-xs font-semibold text-text-muted italic">Vibin'</span>
        </div>
      </main>
    </div>
  )
}

export default Layout
