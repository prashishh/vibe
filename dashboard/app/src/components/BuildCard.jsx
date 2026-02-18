import { Link } from 'react-router-dom'
import StatusBadge from './StatusBadge.jsx'
import ProgressBar from './ProgressBar.jsx'

function BuildCard({ build }) {
  const { version, title, status, goal, tasks, totalTasks, doneTasks } = build

  const riskCounts = tasks.reduce((acc, t) => {
    const level = t.risk.split(/\s/)[0]
    acc[level] = (acc[level] || 0) + 1
    return acc
  }, {})

  return (
    <Link
      to={`/build/${version}`}
      className="block rounded-xl border-2 border-border bg-surface-alt p-6 hover:border-border-light hover:bg-surface-hover transition-all duration-200 no-underline group card-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
              {version}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              build.buildType === 'lite'
                ? 'bg-info/10 text-info'
                : 'bg-accent/10 text-accent'
            }`}>
              {build.buildType === 'lite' ? 'Vibe' : 'Full'}
            </span>
            <StatusBadge status={status} size="sm" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary group-hover:text-accent-hover transition-colors">
            {title}
          </h3>
        </div>
      </div>

      {goal.intent && (
        <p className="text-sm text-text-secondary mb-4">
          {goal.intent}
        </p>
      )}

      <ProgressBar done={doneTasks} total={totalTasks} />

      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">Tasks:</span>
          <span className="text-sm font-medium text-text-primary">{totalTasks}</span>
        </div>

        {goal.guardrailImpact && goal.guardrailImpact.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Guards:</span>
            <span className="text-sm font-medium text-text-primary">
              {goal.guardrailImpact.length}
            </span>
          </div>
        )}

        {Object.keys(riskCounts).length > 0 && (
          <div className="flex items-center gap-1.5 ml-auto">
            {riskCounts.Critical && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-danger/10 text-danger font-medium">
                {riskCounts.Critical} Critical
              </span>
            )}
            {riskCounts.High && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-warning/10 text-warning font-medium">
                {riskCounts.High} High
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}

export default BuildCard
