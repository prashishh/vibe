const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    bg: 'bg-text-muted/10',
    text: 'text-text-muted',
    dot: 'bg-text-muted',
  },
  planning: {
    label: 'Planning',
    bg: 'bg-[#7c3aed]/10',
    text: 'text-[#7c3aed]',
    dot: 'bg-[#7c3aed]',
  },
  in_progress: {
    label: 'In Progress',
    bg: 'bg-info/10',
    text: 'text-info',
    dot: 'bg-info',
  },
  review: {
    label: 'Review',
    bg: 'bg-warning/10',
    text: 'text-warning',
    dot: 'bg-warning',
  },
  deployed: {
    label: 'Deployed',
    taskLabel: 'Done',
    bg: 'bg-success/10',
    text: 'text-success',
    dot: 'bg-success',
  },
  blocked: {
    label: 'Blocked',
    bg: 'bg-danger/10',
    text: 'text-danger',
    dot: 'bg-danger',
  },
}

function StatusBadge({ status, size = 'md', context = 'build' }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'
  const displayLabel = context === 'task' && config.taskLabel ? config.taskLabel : config.label

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.bg} ${config.text} ${sizeClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {displayLabel}
    </span>
  )
}

export default StatusBadge
