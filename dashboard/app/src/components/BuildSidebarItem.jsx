function BuildSidebarItem({ build, selected, onSelect, isPlanning, groupColor, isDone }) {
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

  // Subtle tinted background from group color
  const tintBg = groupColor
    ? selected
      ? `${groupColor}18`   // slightly stronger when selected
      : `${groupColor}0a`   // very subtle tint
    : undefined
  const hoverBg = groupColor ? `${groupColor}14` : undefined

  return (
    <button
      onClick={() => onSelect(build.buildId)}
      className={`group/item w-full text-left px-3 py-2.5 transition-colors border-l-2 ${
        selected
          ? 'border-accent'
          : 'border-transparent'
      }`}
      style={{
        backgroundColor: tintBg,
        borderLeftColor: selected ? groupColor : undefined,
      }}
      onMouseEnter={e => {
        if (!selected) e.currentTarget.style.backgroundColor = hoverBg
      }}
      onMouseLeave={e => {
        if (!selected) e.currentTarget.style.backgroundColor = tintBg
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isDone && (
          <img
            src="/mascot/parrot.png"
            alt=""
            className="w-5 h-5 flex-shrink-0 opacity-80"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-primary truncate leading-snug">
            {build.description || 'Untitled'}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="text-xs text-text-muted"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {build.buildId}
            </span>
            <span className={`text-xs font-semibold ${typeClass}`}>
              {typeLabel}
            </span>
            {isPlanning && (
              <span className="text-xs text-warning animate-pulse">Planning...</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {hasQuestions && (
            <span className="w-2 h-2 rounded-full bg-warning" title="Open questions" />
          )}
          {progress && (
            <span className="text-xs text-text-muted tabular-nums">{progress}</span>
          )}
        </div>
      </div>
    </button>
  )
}

export default BuildSidebarItem
