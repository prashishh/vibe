function ProgressBar({ done, total }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-surface-hover rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: pct === 100 ? 'var(--color-success)' : 'var(--color-accent)',
          }}
        />
      </div>
      <span className="text-xs text-text-muted font-medium whitespace-nowrap">
        {done}/{total} tasks
      </span>
    </div>
  )
}

export default ProgressBar
