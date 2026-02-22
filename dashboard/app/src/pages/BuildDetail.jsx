import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import data from 'virtual:builds-data'
import StatusBadge from '../components/StatusBadge.jsx'
import RiskBadge from '../components/RiskBadge.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import MarkdownView from '../components/MarkdownView.jsx'

const DOC_TABS = [
  { key: 'goal', label: 'Goal' },
  { key: 'plan', label: 'Plan' },
  { key: 'design', label: 'Design' },
  { key: 'testPlan', label: 'Test Plan' },
  { key: 'decisions', label: 'Decisions' },
  { key: 'ship', label: 'Ship' },
  { key: 'recap', label: 'Recap' },
  { key: 'review', label: 'Review' },
]

function BuildDetail() {
  const { version } = useParams()
  const [activeDoc, setActiveDoc] = useState('goal')

  const build = data.builds.find(i => i.version === version)

  if (!build) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 py-8 text-center">
        <p className="text-lg text-text-muted">Build {version} not found.</p>
        <Link to="/" className="text-accent-hover hover:underline mt-4 inline-block">
          Back to dashboard
        </Link>
      </div>
    )
  }

  const { title, status, goal, tasks, totalTasks, doneTasks, docs } = build

  // Filter tabs to only show ones with content
  const availableTabs = DOC_TABS.filter(tab => {
    const content = docs[tab.key]
    return content && content.trim() !== '' && !content.match(/^#[^#]*\n(\n.*TBD\n?)*$/)
  })

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link to="/" className="text-text-muted hover:text-text-primary transition-colors no-underline">
          Builds
        </Link>
        <span className="text-text-muted">/</span>
        <span className="text-text-primary font-medium">{version}</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-mono text-text-muted uppercase tracking-wider">
            {version}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
            build.buildType === 'lite'
              ? 'bg-info/15 text-info'
              : 'bg-accent/15 text-accent-hover'
          }`}>
            {build.buildType === 'lite' ? 'Lite' : 'Full'}
          </span>
          <StatusBadge status={status} />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-3">{title}</h1>
        {goal.intent && (
          <p className="text-text-secondary max-w-3xl">{goal.intent}</p>
        )}
      </div>

      {/* Progress + Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-border bg-surface-alt p-5 md:col-span-2">
          <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-3">
            Progress
          </h3>
          <ProgressBar done={doneTasks} total={totalTasks} />
        </div>

        {goal.guardrailImpact && goal.guardrailImpact.length > 0 && (
          <div className="rounded-xl border border-border bg-surface-alt p-5">
            <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-3">
              Guards Impacted
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {goal.guardrailImpact.map(g => (
                <span
                  key={g.id}
                  className="text-xs px-2 py-1 rounded-md bg-accent/10 text-accent-hover font-mono"
                  title={g.impact}
                >
                  {g.id}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tasks Table */}
      <div className="rounded-xl border border-border bg-surface-alt mb-8 overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-text-primary">Tasks</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                  ID
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Title
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Risk
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Guards
                </th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors">
                  <td className="px-5 py-3 text-sm font-mono text-accent-hover">
                    {task.id}
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-sm font-medium text-text-primary">{task.title}</div>
                    {task.outcome && (
                      <div className="text-xs text-text-muted mt-0.5">{task.outcome}</div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <RiskBadge risk={task.risk} />
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={task.status} size="sm" context="task" />
                  </td>
                  <td className="px-5 py-3 text-xs text-text-muted font-mono">
                    {task.guardrails || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Document Tabs */}
      <div className="rounded-xl border border-border bg-surface-alt overflow-hidden">
        <div className="flex border-b border-border overflow-x-auto">
          {availableTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveDoc(tab.key)}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeDoc === tab.key
                  ? 'border-accent text-accent-hover bg-accent/5'
                  : 'border-transparent text-text-muted hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="p-6 max-h-[600px] overflow-y-auto">
          <MarkdownView content={docs[activeDoc]} />
        </div>
      </div>
    </div>
  )
}

export default BuildDetail
