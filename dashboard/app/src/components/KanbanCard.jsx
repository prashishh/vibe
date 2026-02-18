import { useState } from 'react'
import StatusBadge from './StatusBadge.jsx'

function KanbanCard({ build, selected, onSelect, isPlanning, onAction }) {
  const [dragging, setDragging] = useState(false)

  const handleDragStart = (e) => {
    // Don't allow dragging while planning is in progress
    if (isPlanning) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData('application/vibe-build', JSON.stringify({
      buildId: build.buildId,
      currentStatus: build.status,
    }))
    e.dataTransfer.effectAllowed = 'move'
    setDragging(true)
  }

  const handleDragEnd = () => {
    setDragging(false)
  }

  const typeLabel = build.buildType === 'full' ? 'Full'
    : build.buildType === 'vibe' ? 'Vibe'
    : 'Lite'
  const typeClass = build.buildType === 'full'
    ? 'bg-accent/10 text-accent'
    : build.buildType === 'vibe'
    ? 'bg-warning/10 text-warning'
    : 'bg-info/10 text-info'
  const hasOpenQuestions = Boolean(
    build.needsInput ||
    build.hasOpenQuestions ||
    (build.openQuestionsCount || 0) > 0 ||
    (build.needsInputQuestions || []).length > 0
  )

  return (
    <div
      draggable={!isPlanning}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`rounded-lg border-2 bg-surface p-3 space-y-2 transition-all card-shadow ${
        isPlanning ? 'cursor-wait' : 'cursor-grab'
      } ${
        dragging ? 'opacity-40 scale-95' : ''
      } ${
        selected
          ? 'border-accent ring-1 ring-accent/20'
          : 'border-border hover:border-border-light'
      }`}
      onClick={() => onSelect(build.buildId)}
    >
      {/* Planning spinner overlay */}
      {isPlanning && (
        <div className="flex items-center gap-2 text-xs text-warning font-medium">
          <span className="inline-block w-3 h-3 border-2 border-warning border-t-transparent rounded-full animate-spin" />
          Planning in progress…
        </div>
      )}

      {/* Top row: build ID + type badge */}
      <div className="flex items-center justify-between">
        <span
          className="text-[11px] text-text-muted uppercase tracking-wider"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {build.buildId}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${typeClass}`}>
          {typeLabel}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm font-semibold text-text-primary leading-snug line-clamp-2">
        {build.description || 'Untitled build'}
      </p>

      {/* Task count (only for planned builds) */}
      {build.totalTasks > 0 && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>{build.doneTasks}/{build.totalTasks} tasks</span>
          {build.inProgressTasks > 0 && (
            <span className="text-info">{build.inProgressTasks} active</span>
          )}
        </div>
      )}

      {/* Status badge */}
      <div className="flex items-center justify-between pt-1">
        <StatusBadge status={isPlanning ? 'planning' : build.status} size="sm" />
        {hasOpenQuestions && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning font-semibold">
            Open Questions
          </span>
        )}
      </div>

      {/* Action buttons — one per stage */}
      {onAction && build.status === 'pending' && !isPlanning && (
        <button
          onClick={(e) => { e.stopPropagation(); onAction(build.buildId, 'planning', build.status) }}
          className="w-full text-xs font-semibold px-2 py-1.5 rounded-md border border-[#7c3aed]/40 text-[#7c3aed] hover:bg-[#7c3aed] hover:text-white transition-colors"
        >
          ▶ Start Planning
        </button>
      )}
      {onAction && build.status === 'planning' && !isPlanning && (
        hasOpenQuestions ? (
          <button
            disabled
            className="w-full text-xs font-semibold px-2 py-1.5 rounded-md border border-warning/30 text-warning/70 bg-warning/5 cursor-not-allowed"
          >
            Answer Open Questions
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onAction(build.buildId, 'in_progress', build.status) }}
            className="w-full text-xs font-semibold px-2 py-1.5 rounded-md border border-info/40 text-info hover:bg-info hover:text-white transition-colors"
          >
            ▶ Start Building
          </button>
        )
      )}
      {onAction && build.status === 'in_progress' && (build.pendingTasks > 0 || build.blockedTasks > 0) && (
        <button
          onClick={(e) => { e.stopPropagation(); onAction(build.buildId, 'in_progress', build.status) }}
          className="w-full text-xs font-semibold px-2 py-1.5 rounded-md border border-info/40 text-info hover:bg-info hover:text-white transition-colors"
        >
          ▶ Run Tasks ({build.pendingTasks} pending{build.blockedTasks > 0 ? `, ${build.blockedTasks} blocked` : ''})
        </button>
      )}
      {onAction && build.status === 'in_progress' && (
        <button
          onClick={(e) => { e.stopPropagation(); onAction(build.buildId, 'review', build.status) }}
          className="w-full text-xs font-semibold px-2 py-1.5 rounded-md border border-warning/40 text-warning hover:bg-warning hover:text-white transition-colors"
        >
          ▶ Start Review
        </button>
      )}
      {onAction && build.status === 'review' && (
        <button
          onClick={(e) => { e.stopPropagation(); onAction(build.buildId, 'deployed', build.status) }}
          className="w-full text-xs font-semibold px-2 py-1.5 rounded-md border border-success/40 text-success hover:bg-success hover:text-white transition-colors"
        >
          Ship It!
        </button>
      )}
    </div>
  )
}

export default KanbanCard
