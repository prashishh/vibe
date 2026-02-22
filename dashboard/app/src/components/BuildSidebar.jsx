import { useMemo, useState } from 'react'
import BuildSidebarItem from './BuildSidebarItem.jsx'

const STATUS_GROUPS = [
  { key: 'pending', label: 'Backlog', color: '#5f6380' },
  { key: 'planning', label: 'Planning', color: '#7c3aed' },
  { key: 'in_progress', label: 'In Progress', color: '#60a5fa' },
  { key: 'review', label: 'In Review', color: '#fbbf24' },
  { key: 'deployed', label: 'Done', color: '#34d399' },
  { key: 'blocked', label: 'Stalled', color: '#f87171' },
]

function SidebarGroup({ label, color, items, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-border/50">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-surface-hover/30 transition-colors"
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm font-semibold text-text-secondary flex-1">
          {label}
        </span>
        <span className="text-xs text-text-muted tabular-nums">
          {items.length}
        </span>
        <span className="text-[10px] text-text-muted">
          {open ? '\u25BE' : '\u25B8'}
        </span>
      </button>
      {open && (
        <div className="pb-1">
          {children}
        </div>
      )}
    </div>
  )
}

function BuildSidebar({ builds, selectedBuildId, onSelectBuild, planningBuilds, onNewCycle }) {
  const groups = useMemo(() => {
    const grouped = {}
    for (const g of STATUS_GROUPS) {
      grouped[g.key] = []
    }
    for (const build of builds) {
      const key = grouped[build.status] ? build.status : 'pending'
      grouped[key].push(build)
    }
    // Sort each group by version number ascending
    const versionNum = (buildId = '') => {
      const match = String(buildId).match(/(\d+)/)
      return match ? parseInt(match[1], 10) : Infinity
    }
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => versionNum(a.buildId) - versionNum(b.buildId))
    }
    return STATUS_GROUPS
      .map(g => ({ ...g, items: grouped[g.key] }))
  }, [builds])

  return (
    <aside className="w-72 border-r border-border bg-surface-alt flex flex-col h-full flex-shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">Builds</h2>
        <button
          onClick={onNewCycle}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-accent/40 text-accent hover:bg-accent/10 transition-colors"
        >
          + New
        </button>
      </div>

      {/* Scrollable group list */}
      <div className="flex-1 overflow-y-auto">
        {groups.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-text-muted">No builds yet.</p>
            <p className="text-sm text-text-muted mt-1">Click <strong className="text-text-secondary">+ New</strong> to get started.</p>
          </div>
        )}
        {groups.map(group => (
          <SidebarGroup
            key={group.key}
            label={group.label}
            color={group.color}
            items={group.items}
            defaultOpen={group.key !== 'deployed'}
          >
            {group.items.map(build => (
              <BuildSidebarItem
                key={build.buildId}
                build={build}
                selected={selectedBuildId === build.buildId}
                onSelect={onSelectBuild}
                isPlanning={planningBuilds.has(build.buildId)}
              />
            ))}
          </SidebarGroup>
        ))}
      </div>
    </aside>
  )
}

export default BuildSidebar
