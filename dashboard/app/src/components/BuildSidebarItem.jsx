function BuildSidebarItem({ build, selected, onSelect, isPlanning }) {
  const typeLabel = build.buildType === 'full' ? 'Full'
    : build.buildType === 'vibe' ? 'Vibe'
    : 'Lite'
  const typeClass = build.buildType === 'full'
    ? 'text-accent'
    : build.buildType === 'vibe'
    ? 'text-warning'
    : 'text-info'

  const hasQuestions = Boolean(
    build.needsInput ||
    build.hasOpenQuestions ||
    (build.openQuestionsCount || 0) > 0 ||
    (build.needsInputQuestions || []).length > 0
  )

  const progress = build.totalTasks > 0
    ? `${build.doneTasks}/${build.totalTasks}`
    : null

  return (
    <button
      onClick={() => onSelect(build.buildId)}
      className={`w-full text-left px-3 py-2.5 transition-colors border-l-2 ${
        selected
          ? 'bg-surface-hover border-accent'
          : 'border-transparent hover:bg-surface-hover/50'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-primary truncate leading-snug">
            {build.description || 'Untitled'}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="text-[10px] text-text-muted"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {build.buildId}
            </span>
            <span className={`text-[10px] font-semibold ${typeClass}`}>
              {typeLabel}
            </span>
            {isPlanning && (
              <span className="text-[10px] text-warning animate-pulse">Planning...</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {hasQuestions && (
            <span className="w-2 h-2 rounded-full bg-warning" title="Open questions" />
          )}
          {progress && (
            <span className="text-[10px] text-text-muted tabular-nums">{progress}</span>
          )}
        </div>
      </div>
    </button>
  )
}

export default BuildSidebarItem
