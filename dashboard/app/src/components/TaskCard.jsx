import { useState } from 'react'
import RiskBadge from './RiskBadge.jsx'
import StatusBadge from './StatusBadge.jsx'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Backlog' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'deployed', label: 'Deployed' },
  { value: 'blocked', label: 'Blocked' },
]

function TaskCard({ task, selected, running, onSelect, onStatusChange, onExecute, onDelete }) {
  const [showActions, setShowActions] = useState(false)
  const [dragging, setDragging] = useState(false)

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', task.id)
    e.dataTransfer.effectAllowed = 'move'
    setDragging(true)
  }

  const handleDragEnd = () => {
    setDragging(false)
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`rounded-lg border-2 bg-surface p-3 space-y-2 cursor-grab transition-all card-shadow ${
        dragging ? 'opacity-40 scale-95' : ''
      } ${
        selected
          ? 'border-accent ring-1 ring-accent/20'
          : 'border-border hover:border-border-light'
      }`}
      onClick={() => onSelect(task.id)}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Top row: ID + risk */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-muted" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{task.id}</span>
        <RiskBadge risk={task.risk || 'Medium'} />
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-text-primary leading-snug">{task.title}</p>

      {/* Outcome snippet */}
      {task.outcome && (
        <p className="text-xs text-text-secondary line-clamp-2">{task.outcome}</p>
      )}

      {/* Blocked reason */}
      {task.status === 'blocked' && task.blockedReason && (
        <div className="rounded border border-danger/30 bg-danger/5 px-2 py-1">
          <p className="text-[11px] text-danger leading-tight">{task.blockedReason}</p>
        </div>
      )}

      {/* Bottom row: status + running indicator */}
      <div className="flex items-center justify-between pt-1">
        {running ? (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-info/15 text-info font-medium animate-pulse">
            Running...
          </span>
        ) : (
          <StatusBadge status={task.status} size="sm" context="task" />
        )}
      </div>

      {/* Hover actions */}
      {showActions && !dragging && (
        <div className="flex items-center gap-1 pt-1 border-t border-border/50">
          <select
            value={task.status}
            onChange={(e) => { e.stopPropagation(); onStatusChange(task.id, e.target.value) }}
            className="bg-surface-alt border border-border rounded px-1.5 py-0.5 text-xs text-text-primary flex-1"
            onClick={(e) => e.stopPropagation()}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={(e) => { e.stopPropagation(); onExecute(task.id) }}
            className="px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success hover:bg-success/20"
          >
            Run
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(task.id) }}
            className="px-2 py-0.5 rounded text-xs font-medium text-danger hover:bg-danger/10"
          >
            Del
          </button>
        </div>
      )}
    </div>
  )
}

export default TaskCard
