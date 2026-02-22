import data from 'virtual:builds-data'
import { Link } from 'react-router-dom'

function Changelog() {
  const { changelog } = data

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          Changelog
        </h1>
        <p className="text-text-secondary">
          Everything that shipped — builds and vibes.
          Sourced from <code className="text-accent-hover text-sm">CHANGELOG.md</code>.
        </p>
      </div>

      {changelog.length === 0 ? (
        <div className="text-center py-16 text-text-muted max-w-md mx-auto">
          <p className="text-lg">No changelog entries yet.</p>
          <p className="text-sm mt-2 leading-relaxed">
            Your changelog will be created automatically when the first cycle is shipped. Each shipped cycle adds an entry from its <code className="text-accent-hover">RECAP.md</code>.
          </p>

          {/* Preview of what a changelog entry will look like */}
          <div className="mt-8 text-left opacity-40 pointer-events-none">
            <div className="relative flex gap-4">
              <div className="relative z-10 mt-1.5 flex-shrink-0">
                <div className="w-[10px] h-[10px] rounded-full border-2 border-accent bg-accent" />
              </div>
              <div className="flex-1 rounded-xl border border-border bg-surface-alt p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider bg-accent/15 text-accent-hover">
                    v1
                  </span>
                  <h3 className="text-base font-semibold text-text-primary">Your first shipped cycle</h3>
                </div>
                <ul className="space-y-1">
                  <li className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0 bg-text-muted" />
                    <span className="text-text-secondary">Changes from your build will appear here...</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />

          <div className="space-y-6">
            {changelog.map((entry, i) => (
              <div key={i} className="relative flex gap-4">
                {/* Timeline dot */}
                <div className="relative z-10 mt-1.5 flex-shrink-0">
                  <div
                    className={`w-[10px] h-[10px] rounded-full border-2 ${
                      entry.type === 'build'
                        ? 'border-accent bg-accent'
                        : 'border-success bg-success'
                    }`}
                  />
                </div>

                {/* Card */}
                <div className="flex-1 rounded-xl border border-border bg-surface-alt p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${
                        entry.type === 'build'
                          ? 'bg-accent/15 text-accent-hover'
                          : 'bg-success/15 text-success'
                      }`}
                    >
                      {entry.type === 'build' ? entry.version : 'vibe'}
                    </span>
                    <h3 className="text-base font-semibold text-text-primary">
                      {entry.type === 'build' ? (
                        <Link
                          to={`/build/${entry.version}`}
                          className="hover:text-accent-hover transition-colors"
                        >
                          {entry.title}
                        </Link>
                      ) : (
                        entry.title
                      )}
                    </h3>
                    {entry.date && (
                      <span className="text-xs text-text-muted ml-auto">
                        {entry.date}
                      </span>
                    )}
                  </div>

                  <ul className="space-y-1">
                    {entry.items.map((item, j) => {
                      const isGuardLine = item.startsWith('Guards:')
                      return (
                        <li key={j} className="flex items-start gap-2 text-sm">
                          <span className={`mt-1.5 w-1 h-1 rounded-full flex-shrink-0 ${
                            isGuardLine ? 'bg-success' : 'bg-text-muted'
                          }`} />
                          <span className={isGuardLine ? 'text-success font-medium' : 'text-text-secondary'}>
                            {item}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Changelog
