import { useState } from 'react'
import KanbanCard from './KanbanCard.jsx'

function InfoTooltip({ text }) {
  const [visible, setVisible] = useState(false)
  return (
    <span className="relative flex items-center">
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="w-4 h-4 rounded-full border border-text-muted/40 text-text-muted hover:text-text-primary hover:border-text-primary flex items-center justify-center text-[10px] font-bold leading-none transition-colors"
        aria-label="Column info"
      >
        ?
      </button>
      {visible && (
        <span
          className="absolute left-5 top-1/2 -translate-y-1/2 z-50 w-56 rounded-lg border border-border bg-surface card-shadow px-3 py-2 text-xs text-text-secondary leading-relaxed pointer-events-none"
        >
          {text}
        </span>
      )}
    </span>
  )
}

// Allowed transitions: which columns can receive drops from which source status
// Must stay aligned with VALID_TRANSITIONS in server/services/tasks-store.js
const ALLOWED_DROPS = {
  pending: ['blocked'],                            // Idea: from Stalled (reset to backlog)
  planning: ['pending', 'blocked'],                // Planning: from Idea or Stalled
  in_progress: ['planning', 'review', 'blocked'],  // Building: from Planning, Review (rework), or Stalled
  review: ['in_progress', 'blocked'],              // Review: from Building or Stalled
  deployed: ['review'],                            // Shipped: from Review only
  blocked: ['in_progress', 'review'],              // Stalled: only from Building or Review (active execution)
}

function TaskColumn({
  title,
  tooltip,
  status,
  color,
  builds,
  selectedBuildId,
  onSelectBuild,
  onDrop,
  onAddCard,
  isBuildPlanning,
  onAction,
}) {
  const [dragOver, setDragOver] = useState(false)
  const [dropBlocked, setDropBlocked] = useState(false)

  const handleDragOver = (e) => {
    e.preventDefault()

    // Check if this drop is allowed
    try {
      const raw = e.dataTransfer.types.includes('application/vibe-build')
      if (!raw) return
    } catch {
      // Can't read data during dragover in some browsers
    }

    e.dataTransfer.dropEffect = 'move'
    setDragOver(true)
    setDropBlocked(false)
  }

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(false)
      setDropBlocked(false)
    }
  }

  const handleDropEvent = (e) => {
    e.preventDefault()
    setDragOver(false)
    setDropBlocked(false)

    const raw = e.dataTransfer.getData('application/vibe-build')
    if (!raw) return

    try {
      const { buildId, currentStatus } = JSON.parse(raw)
      if (!buildId || currentStatus === status) return

      // Block drops if this build is currently mid-planning
      if (isBuildPlanning && isBuildPlanning(buildId)) {
        setDropBlocked(true)
        setTimeout(() => setDropBlocked(false), 1500)
        return
      }

      // Enforce movement rules
      const allowed = ALLOWED_DROPS[status] || []
      if (!allowed.includes(currentStatus)) {
        setDropBlocked(true)
        setTimeout(() => setDropBlocked(false), 1500)
        return
      }

      onDrop(buildId, status, currentStatus)
    } catch {
      // Invalid data
    }
  }

  return (
    <section
      className={`rounded-xl border-2 flex flex-col flex-shrink-0 transition-colors ${
        dropBlocked
          ? 'border-danger border-dashed'
          : dragOver
            ? 'border-accent border-dashed'
            : 'border-border'
      }`}
      style={{
        backgroundColor: dragOver && !dropBlocked ? 'var(--color-surface-hover)' : (color || 'var(--color-surface-alt)'),
        width: '280px',
        minWidth: '280px',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropEvent}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-border">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-text-primary">{title}</h3>
          <span className="text-xs font-semibold text-text-muted bg-surface/60 rounded-full px-2 py-0.5">
            {builds.length}
          </span>
          {tooltip && <InfoTooltip text={tooltip} />}
        </div>
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {builds.map(build => (
          <KanbanCard
            key={build.buildId}
            build={build}
            selected={selectedBuildId === build.buildId}
            onSelect={onSelectBuild}
            isPlanning={isBuildPlanning ? isBuildPlanning(build.buildId) : false}
            onAction={onAction}
          />
        ))}

        {builds.length === 0 && !dragOver && (
          <div className="rounded-lg border-2 border-dashed border-border/60 p-4 text-xs text-text-muted text-center">
            No cycles
          </div>
        )}

        {builds.length === 0 && dragOver && !dropBlocked && (
          <div className="rounded-lg border-2 border-dashed border-accent/40 bg-accent/5 p-4 text-xs text-accent text-center">
            Drop here
          </div>
        )}

        {dropBlocked && (
          <div className="rounded-lg border-2 border-dashed border-danger/40 bg-danger/5 p-4 text-xs text-danger text-center">
            Cannot move here
          </div>
        )}
      </div>

      {/* New cycle button (Idea column only) */}
      {onAddCard && (
        <div className="p-3 border-t-2 border-border">
          <button
            onClick={onAddCard}
            className="w-full text-center text-sm font-bold text-accent border-2 border-accent/40 hover:bg-accent hover:text-white hover:border-accent rounded-lg px-3 py-2 transition-colors"
          >
            + New Cycle
          </button>
        </div>
      )}
    </section>
  )
}

export default TaskColumn
