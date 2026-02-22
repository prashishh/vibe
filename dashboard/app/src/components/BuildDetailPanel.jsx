import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import StatusBadge from './StatusBadge.jsx'
import MarkdownView from './MarkdownView.jsx'
import RiskBadge from './RiskBadge.jsx'
import DiffViewer from './DiffViewer.jsx'
import PRModal from './PRModal.jsx'

// ─── Elapsed Timer ────────────────────────────────────────────────────────────
function ElapsedTimer() {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  return (
    <span className="tabular-nums">
      {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
    </span>
  )
}

// ─── Parse GOAL.md to extract Intent and Success Metric ──────────────────────
function parseGoalSections(goalContent) {
  if (!goalContent) return { intent: '', successMetric: '' }

  const sections = {}
  const sectionPattern = /^##\s+(.+)$/gm
  const matches = [...goalContent.matchAll(sectionPattern)]

  for (let i = 0; i < matches.length; i++) {
    const name = matches[i][1].trim().toLowerCase()
    const start = matches[i].index + matches[i][0].length
    const end = i + 1 < matches.length ? matches[i + 1].index : goalContent.length
    const body = goalContent.slice(start, end).trim()
    sections[name] = body
  }

  return {
    intent: sections['intent'] || '',
    successMetric: sections['success metric'] || sections['success metrics'] || '',
  }
}

// ─── Check if doc content is substantive ──────────────────────────────────────
function hasSubstantiveContent(content) {
  if (!content) return false
  const stripped = content
    .replace(/^#+\s.*$/gm, '')
    .replace(/\bTBD\b/gi, '')
    .replace(/[-\u2013\u2014]/g, '')
    .replace(/runner did not generate this file/gi, '')
    .replace(/\s+/g, '')
  return stripped.length > 20
}

function normalizeQuestion(value) {
  return String(value || '')
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/^\s*[-*>\d.)]+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function collectQuestions(pendingQuestions = []) {
  const deduped = []
  const seen = new Set()
  for (const group of pendingQuestions) {
    const list = Array.isArray(group?.questions) ? group.questions : []
    for (const raw of list) {
      const q = normalizeQuestion(raw)
      if (!q || q === '?' || seen.has(q)) continue
      seen.add(q)
      deduped.push(q)
    }
  }
  return deduped
}

// ─── Editable Document ────────────────────────────────────────────────────────
function EditableDoc({ title, content, onSave, buildId, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(content || '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const textareaRef = useRef(null)

  useEffect(() => {
    if (!editing) {
      setDraft(content || '')
      setSaveError('')
    }
  }, [content, editing])

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(0, 0)
    }
  }, [editing])

  if (!content && !editing) return null

  const handleSave = async () => {
    if (!onSave) return
    setSaving(true)
    setSaveError('')
    try {
      await onSave(title, draft)
      setEditing(false)
    } catch (err) {
      setSaveError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setDraft(content || '')
    setSaveError('')
    setEditing(false)
  }

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2">
        <button
          onClick={() => { if (!editing) setExpanded(!expanded) }}
          className="flex items-center gap-1.5 text-left hover:opacity-80 transition-opacity"
        >
          <span className="text-xs text-text-muted">{editing || expanded ? '\u25BE' : '\u25B8'}</span>
          <span className="text-sm font-semibold text-text-secondary">{title}</span>
        </button>
        {!editing ? (
          <button
            onClick={() => { setEditing(true); setExpanded(true) }}
            className="text-xs text-accent hover:text-accent-hover font-medium transition-colors"
          >
            Edit
          </button>
        ) : (
          <span className="text-xs text-text-muted italic">Editing</span>
        )}
      </div>

      {editing && (
        <div className="px-3 pb-3 space-y-2">
          {buildId && (
            <p className="text-xs text-text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
              .vibe/builds/{buildId}/{title}
            </p>
          )}
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full min-h-48 max-h-[60vh] p-2.5 rounded-lg border border-border bg-surface-alt text-sm text-text-primary leading-relaxed resize-y focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
            style={{ fontFamily: 'var(--font-mono)' }}
            spellCheck={false}
          />
          {saveError && (
            <p className="text-xs text-danger font-medium">{saveError}</p>
          )}
          <div className="flex items-center gap-2 justify-end">
            <span className="text-xs text-text-muted mr-auto">
              {navigator.platform?.includes('Mac') ? '\u2318S' : 'Ctrl+S'} to save &middot; Esc to cancel
            </span>
            <button
              onClick={handleCancel}
              className="px-2.5 py-1 rounded text-xs font-medium border border-border text-text-muted hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || draft === content}
              className="px-2.5 py-1 rounded text-xs font-semibold bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {!editing && !expanded && (
        <div className="px-3 pb-2 line-clamp-3 overflow-hidden text-xs">
          <MarkdownView content={content} compact />
        </div>
      )}

      {!editing && expanded && (
        <div className="px-3 pb-3 border-t border-border pt-2 text-xs">
          <MarkdownView content={content} compact />
        </div>
      )}
    </div>
  )
}

// ─── Progress Banner ──────────────────────────────────────────────────────────
const BANNER_THEMES = {
  warning: {
    bg: 'bg-warning/5',
    borderOuter: 'border-warning/30',
    borderInner: 'border-warning border-t-transparent',
    text: 'text-warning',
    trackBg: 'bg-warning/10',
    barBg: 'bg-warning/60',
  },
  info: {
    bg: 'bg-info/5',
    borderOuter: 'border-info/30',
    borderInner: 'border-info border-t-transparent',
    text: 'text-info',
    trackBg: 'bg-info/10',
    barBg: 'bg-info/60',
  },
  success: {
    bg: 'bg-success/5',
    borderOuter: 'border-success/30',
    borderInner: 'border-success border-t-transparent',
    text: 'text-success',
    trackBg: 'bg-success/10',
    barBg: 'bg-success/60',
  },
}

function ProgressBanner({ theme = 'warning', title, subtitle }) {
  const t = BANNER_THEMES[theme] || BANNER_THEMES.warning
  return (
    <div className={`px-5 py-3 border-b border-border ${t.bg}`}>
      <div className="flex items-center gap-3">
        <div className="relative w-5 h-5 flex-shrink-0">
          <span className={`absolute inset-0 rounded-full border-2 ${t.borderOuter}`} />
          <span className={`absolute inset-0 rounded-full border-2 ${t.borderInner} animate-spin`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${t.text}`}>{title}</p>
          <p className="text-xs text-text-muted">{subtitle}</p>
        </div>
        <div className="text-xs text-text-muted flex-shrink-0">
          <ElapsedTimer />
        </div>
      </div>
      <div className={`mt-2 h-1 rounded-full ${t.trackBg} overflow-hidden`}>
        <div className={`h-full rounded-full ${t.barBg} planning-slide-bar`} />
      </div>
    </div>
  )
}

// ─── Status options ───────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'planning', label: 'Planning' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'deployed', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
]

// ─── Task Row ─────────────────────────────────────────────────────────────────
function EditableTaskRow({ task, onPatch, onExecute, onCancel }) {
  const [expanded, setExpanded] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(task.title)
  const [showStatusSelect, setShowStatusSelect] = useState(false)
  const [executing, setExecuting] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!editingTitle) setTitleDraft(task.title)
  }, [task.title, editingTitle])

  useEffect(() => {
    if (editingTitle && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingTitle])

  const handleTitleSave = async () => {
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== task.title && onPatch) {
      try {
        await onPatch(task.id, { title: trimmed })
      } catch (err) {
        console.error('Failed to update task title:', err)
      }
    }
    setEditingTitle(false)
  }

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleTitleSave() }
    if (e.key === 'Escape') { e.preventDefault(); setTitleDraft(task.title); setEditingTitle(false) }
  }

  const handleStatusChange = async (newStatus) => {
    setShowStatusSelect(false)
    if (newStatus !== task.status && onPatch) {
      try {
        await onPatch(task.id, { status: newStatus })
      } catch (err) {
        console.error('Failed to update task status:', err)
      }
    }
  }

  const handleExecute = async () => {
    if (!onExecute) return
    setExecuting(true)
    try { await onExecute(task.id) } finally { setExecuting(false) }
  }

  const isRunnable = task.status === 'pending' || task.status === 'planning' || task.status === 'blocked'
  const isRunning = task.status === 'in_progress'
  const hasDetails = task.outcome || task.acceptance?.length > 0 || task.files?.length > 0 || task.guardrails?.length > 0

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 space-y-1.5">
      <div className="flex items-start gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-text-muted mt-0.5 flex-shrink-0 flex items-center gap-1 hover:text-text-secondary transition-colors"
          style={{ fontFamily: 'var(--font-mono)' }}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <span className="text-xs">{expanded ? '\u25BE' : '\u25B8'}</span>
          {task.id}
        </button>

        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              ref={inputRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyDown}
              className="w-full text-sm text-text-primary bg-surface-alt border border-accent/40 rounded px-1.5 py-0.5 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
            />
          ) : (
            <span
              onClick={() => setExpanded(!expanded)}
              className="text-sm text-text-primary leading-snug cursor-pointer hover:text-accent transition-colors"
              title={hasDetails ? 'Click to see details' : undefined}
            >
              {task.title}
            </span>
          )}
        </div>

        <div className="flex-shrink-0 mt-0.5 relative">
          {showStatusSelect ? (
            <select
              value={task.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              onBlur={() => setShowStatusSelect(false)}
              autoFocus
              className="text-xs rounded border border-border bg-surface px-1 py-0.5 focus:outline-none focus:border-accent"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <span
              onClick={() => { if (onPatch) setShowStatusSelect(true) }}
              className={onPatch ? 'cursor-pointer' : ''}
              title={onPatch ? 'Click to change status' : undefined}
            >
              <StatusBadge status={task.status} size="sm" context="task" />
            </span>
          )}
        </div>
      </div>

      {task.status === 'blocked' && task.blockedReason && (
        <p className="text-xs text-danger ml-6 leading-snug">
          {task.blockedReason}
        </p>
      )}

      {expanded && !editingTitle && (
        <div className="ml-6 space-y-2 pt-1 border-t border-border/50 mt-1.5">
          {task.outcome && (
            <div className="pt-1.5">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Outcome</span>
              <p className="text-sm text-text-secondary leading-relaxed mt-0.5">{task.outcome}</p>
            </div>
          )}
          {task.risk && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Risk</span>
              <RiskBadge risk={task.risk} />
            </div>
          )}
          {task.acceptance?.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Acceptance</span>
              <ul className="mt-0.5 space-y-0.5">
                {task.acceptance.map((item, i) => (
                  <li key={i} className="text-xs text-text-secondary flex items-start gap-1.5">
                    <span className="text-text-muted mt-px">{'\u2610'}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {task.files?.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Files</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {task.files.map((f, i) => (
                  <code key={i} className="text-xs px-1.5 py-0.5 rounded bg-surface-alt text-accent" style={{ fontFamily: 'var(--font-mono)' }}>
                    {f}
                  </code>
                ))}
              </div>
            </div>
          )}
          {task.guardrails?.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Guardrails</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {task.guardrails.map((g, i) => (
                  <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-warning/10 text-warning font-medium">{g}</span>
                ))}
              </div>
            </div>
          )}
          {onPatch && (
            <button
              onClick={(e) => { e.stopPropagation(); setEditingTitle(true); setExpanded(false) }}
              className="text-xs px-2 py-0.5 rounded font-medium text-accent hover:bg-accent/10 transition-colors mt-1"
            >
              Edit Title
            </button>
          )}
        </div>
      )}

      {(onExecute || onCancel) && (
        <div className="flex items-center gap-2 ml-6">
          {isRunnable && onExecute && (
            <button
              onClick={handleExecute}
              disabled={executing}
              className="text-xs px-2 py-0.5 rounded font-medium bg-info/10 text-info hover:bg-info/20 transition-colors disabled:opacity-50"
            >
              {executing ? 'Starting...' : '\u25B6 Run'}
            </button>
          )}
          {isRunning && onCancel && (
            <button
              onClick={() => onCancel(task.id)}
              className="text-xs px-2 py-0.5 rounded font-medium bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
            >
              {'\u25A0'} Cancel
            </button>
          )}
          {isRunning && (
            <span className="text-xs text-info animate-pulse">Running...</span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Document tab mapping ────────────────────────────────────────────────────
const DOC_TAB_MAP = [
  { key: 'goal', docName: 'GOAL.md', label: 'Goal' },
  { key: 'plan', docName: 'PLAN.md', label: 'Plan' },
  { key: 'design', docName: 'DESIGN.md', label: 'Design' },
  { key: 'tasks-doc', docName: 'TASKS.md', label: 'Tasks Doc' },
  { key: 'test-plan', docName: 'TEST_PLAN.md', label: 'Test Plan' },
  { key: 'decisions', docName: 'DECISIONS.md', label: 'Decisions' },
  { key: 'review', docName: 'REVIEW.md', label: 'Review' },
  { key: 'ship', docName: 'SHIP.md', label: 'Ship' },
  { key: 'recap', docName: 'RECAP.md', label: 'Recap' },
]

// ─── Main BuildDetailPanel ───────────────────────────────────────────────────
function BuildDetailPanel({
  onDelete,
  onSaveDoc,
  onPatchTask,
  onExecuteTask,
  onCancelTask,
  onAction,
  onRefreshBuilds,
  buildInfo,
  tasks = [],
  buildDocs = {},
  isPlanning = false,
  pendingQuestions = [],
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  // Diff / Changes tab state
  const [diffFiles, setDiffFiles] = useState([])
  const [selectedDiffFile, setSelectedDiffFile] = useState(null)
  const [currentDiff, setCurrentDiff] = useState(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const diffAbortRef = useRef(null)

  // PR modal state
  const [showPRModal, setShowPRModal] = useState(false)

  // Available tabs
  const availableTabs = useMemo(() => {
    const tabs = [{ key: 'overview', label: 'Overview' }]
    for (const mapping of DOC_TAB_MAP) {
      if (hasSubstantiveContent(buildDocs[mapping.docName])) {
        tabs.push(mapping)
      } else if (
        mapping.docName === 'RECAP.md' &&
        (buildInfo?.status === 'deployed' || buildInfo?.status === 'review')
      ) {
        tabs.push(mapping)
      }
    }
    const knownDocNames = new Set(DOC_TAB_MAP.map(m => m.docName))
    Object.keys(buildDocs).forEach(name => {
      if (!knownDocNames.has(name) && hasSubstantiveContent(buildDocs[name])) {
        tabs.push({ key: `doc-${name}`, docName: name, label: name.replace('.md', '') })
      }
    })
    if (
      (buildInfo?.status === 'review' || buildInfo?.status === 'deployed') &&
      buildInfo?.gitEnabled
    ) {
      tabs.splice(tabs.length, 0, { key: 'changes', label: 'Changes' })
    }
    tabs.push({ key: 'settings', label: 'Settings' })
    return tabs
  }, [buildDocs, buildInfo?.status, buildInfo?.gitEnabled])

  useEffect(() => {
    if (activeTab === 'overview') return
    const tabExists = availableTabs.some(t => t.key === activeTab)
    if (!tabExists) setActiveTab('overview')
  }, [availableTabs, activeTab])

  // Load diff file list
  useEffect(() => {
    if (activeTab !== 'changes' || !buildInfo?.buildId) return
    const controller = new AbortController()
    setDiffLoading(true)
    setDiffFiles([])
    setSelectedDiffFile(null)
    setCurrentDiff(null)
    fetch(`/api/git/builds/${buildInfo.buildId}/diff`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (!controller.signal.aborted) {
          setDiffFiles(data.files || [])
          setDiffLoading(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setDiffLoading(false)
      })
    return () => controller.abort()
  }, [activeTab, buildInfo?.buildId])

  const handleSelectDiffFile = useCallback((file) => {
    if (diffAbortRef.current) diffAbortRef.current.abort()
    const controller = new AbortController()
    diffAbortRef.current = controller
    setSelectedDiffFile(file)
    setCurrentDiff(null)
    const qs = `?path=${encodeURIComponent(file.path)}`
    fetch(`/api/git/builds/${buildInfo.buildId}/diff/${file.taskId}${qs}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => { if (!controller.signal.aborted) setCurrentDiff(data.diff ?? '') })
      .catch(() => { if (!controller.signal.aborted) setCurrentDiff('') })
  }, [buildInfo?.buildId])

  const handleCreatePR = useCallback(async ({ title, body, base }) => {
    const res = await fetch(`/api/git/builds/${buildInfo.buildId}/pr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, base }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'PR creation failed')
    if (onRefreshBuilds) onRefreshBuilds()
    return data
  }, [buildInfo?.buildId, onRefreshBuilds])

  const prDefaultBody = useMemo(() => {
    const recap = buildDocs['RECAP.md']
    if (recap && recap.length > 50) return recap.slice(0, 500)
    const taskList = (tasks || []).map(t => `- ${t.id}: ${t.title}`).join('\n')
    return `## Changes\n\nBuild ${buildInfo?.buildId || ''}.\n\n## Tasks\n\n${taskList}`
  }, [buildDocs, buildInfo?.buildId, tasks])

  const goalSections = useMemo(
    () => parseGoalSections(buildDocs['GOAL.md']),
    [buildDocs]
  )

  if (!buildInfo) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface">
        <p className="text-sm text-text-muted">Select a build to view details.</p>
      </div>
    )
  }

  const typeLabel = buildInfo.buildType === 'full' ? 'Full'
    : buildInfo.buildType === 'vibe' ? 'Vibe'
    : 'Lite'
  const typeClass = buildInfo.buildType === 'full'
    ? 'bg-accent/10 text-accent'
    : buildInfo.buildType === 'vibe'
    ? 'bg-warning/10 text-warning'
    : 'bg-info/10 text-info'

  const runningCount = (tasks || []).filter(t => t.status === 'in_progress').length
  const blockedCount = (tasks || []).filter(t => t.status === 'blocked').length
  const runnerQuestions = collectQuestions(pendingQuestions)
  // Derive open-questions state purely from the parent-provided pendingQuestions prop
  // (which is already filtered/dismissed upstream in AgentWorkspace)
  const hasOpenQuestions = runnerQuestions.length > 0
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface">
      {/* ── Section A: Fixed Header ────────────────────────────── */}
      <div className="flex-shrink-0">
        {/* Build header */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-text-muted" style={{ fontFamily: 'var(--font-mono)' }}>{buildInfo.buildId}</p>
              <h2 className="text-lg font-semibold text-text-primary mt-0.5">{buildInfo.description || 'Untitled'}</h2>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <StatusBadge status={buildInfo.status} size="sm" />
              <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${typeClass}`}>
                {typeLabel}
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-2">
            {buildInfo.totalTasks > 0 && (
              <span className="text-xs text-text-muted">
                {buildInfo.doneTasks}/{buildInfo.totalTasks} done
              </span>
            )}
            {runningCount > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-info/10 text-info font-medium">
                {runningCount} running
              </span>
            )}
            {blockedCount > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-danger/10 text-danger font-medium">
                {blockedCount} blocked
              </span>
            )}
            {hasOpenQuestions && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-warning/10 text-warning font-semibold">
                Open Questions
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {onAction && buildInfo.status === 'pending' && !isPlanning && (
          <div className="px-6 py-3 border-b border-border">
            <button
              onClick={() => onAction(buildInfo.buildId, 'planning', buildInfo.status)}
              className="px-6 py-2 rounded-lg text-sm font-semibold bg-[#7c3aed] text-white hover:bg-[#7c3aed]/90 transition-colors"
            >
              Start Planning
            </button>
          </div>
        )}
        {onAction && buildInfo.status === 'planning' && !isPlanning && (
          <div className="px-6 py-3 border-b border-border">
            {hasOpenQuestions ? (
              <button
                disabled
                className="px-6 py-2 rounded-lg text-sm font-semibold border border-warning/40 text-warning bg-warning/5 cursor-not-allowed"
              >
                Answer Open Questions First
              </button>
            ) : (
              <button
                onClick={() => onAction(buildInfo.buildId, 'in_progress', buildInfo.status)}
                className="px-6 py-2 rounded-lg text-sm font-semibold bg-info text-white hover:bg-info/90 transition-colors"
              >
                Start Building
              </button>
            )}
          </div>
        )}
        {onAction && buildInfo.status === 'in_progress' && (() => {
          const pendingCount = tasks.filter(t => t.status === 'pending').length
          const blockedCountLocal = tasks.filter(t => t.status === 'blocked').length
          const hasUnfinished = pendingCount > 0 || blockedCountLocal > 0
          return (
            <div className="px-6 py-3 border-b border-border flex items-center gap-3">
              {hasUnfinished && (
                <button
                  onClick={() => onAction(buildInfo.buildId, 'in_progress', buildInfo.status)}
                  className="px-6 py-2 rounded-lg text-sm font-semibold bg-info text-white hover:bg-info/90 transition-colors"
                >
                  Run Tasks ({pendingCount} pending{blockedCountLocal > 0 ? `, ${blockedCountLocal} blocked` : ''})
                </button>
              )}
              <button
                onClick={() => onAction(buildInfo.buildId, 'review', buildInfo.status)}
                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  hasUnfinished
                    ? 'border border-warning/40 text-warning hover:bg-warning hover:text-white'
                    : 'bg-warning text-white hover:bg-warning/90'
                }`}>
                Start Review
              </button>
            </div>
          )
        })()}
        {onAction && buildInfo.status === 'review' && (
          <div className="px-6 py-3 border-b border-border flex items-center gap-3">
            <button
              onClick={() => onAction(buildInfo.buildId, 'deployed', buildInfo.status)}
              className="px-6 py-2 rounded-lg text-sm font-semibold bg-success text-white hover:bg-success/90 transition-colors"
            >
              Ship It!
            </button>
            {buildInfo.gitEnabled && !buildInfo.prUrl && (
              <button
                onClick={() => setShowPRModal(true)}
                className="px-6 py-2 rounded-lg text-sm font-semibold border border-accent/40 text-accent hover:bg-accent/10 transition-colors"
              >
                Create PR
              </button>
            )}
            {buildInfo.prUrl && (
              <a
                href={buildInfo.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-2 rounded-lg text-sm font-semibold text-center border border-success/40 text-success hover:bg-success/10 transition-colors"
              >
                View PR #{buildInfo.prNumber}
              </a>
            )}
          </div>
        )}

        {/* Progress banners */}
        {isPlanning && (
          <ProgressBanner
            theme="warning"
            title="Planning in progress"
            subtitle="Invoking skill, reading project context, generating build docs..."
          />
        )}
        {!isPlanning && buildInfo.status === 'in_progress' && runningCount > 0 && (
          <ProgressBanner
            theme="info"
            title={`Building \u2014 ${runningCount} task${runningCount > 1 ? 's' : ''} running`}
            subtitle={`${tasks.filter(t => t.status === 'review' || t.status === 'deployed').length}/${tasks.length} tasks complete`}
          />
        )}

        {/* Runner questions — prominent banner */}
        {runnerQuestions.length > 0 && (
          <div className="px-6 py-4 border-b-2 border-warning/40 bg-warning/8">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-warning text-sm font-bold">?</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-warning">
                  Agent needs your input
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  {isPlanning
                    ? 'Questions are captured. Reply in chat once planning finishes.'
                    : `${runnerQuestions.length} question${runnerQuestions.length === 1 ? '' : 's'} — reply in the chat below.`}
                </p>
                <div className="mt-2 space-y-1.5">
                  {runnerQuestions.slice(0, 3).map((q, i) => (
                    <div key={i} className="bg-warning/10 rounded-lg px-3 py-2 text-xs text-text-secondary leading-relaxed">
                      {q}
                    </div>
                  ))}
                  {runnerQuestions.length > 3 && (
                    <p className="text-xs text-text-muted">+{runnerQuestions.length - 3} more in chat below</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex border-b border-border overflow-x-auto px-2">
          {availableTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 px-4 py-2.5 text-sm font-semibold transition-colors relative whitespace-nowrap ${
                activeTab === tab.key
                  ? 'text-accent'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Section B: Scrollable Content ──────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {buildInfo.status === 'pending' && !isPlanning && (
              <div className="p-6">
                <div className="rounded-lg border border-border bg-surface-alt p-5 text-center space-y-2">
                  <p className="text-sm font-medium text-text-primary">Backlog</p>
                  <p className="text-xs text-text-muted">Click <strong>Start Planning</strong> above to generate build documents and tasks.</p>
                </div>
              </div>
            )}

            {buildInfo.status !== 'pending' && (
              <div className="p-6 pb-0 space-y-3">
                {goalSections.intent ? (
                  <div>
                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Intent</h4>
                    <div className="text-sm text-text-secondary leading-relaxed">
                      <MarkdownView content={goalSections.intent} compact />
                    </div>
                  </div>
                ) : buildInfo.description ? (
                  <div>
                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Description</h4>
                    <p className="text-sm text-text-secondary leading-relaxed">{buildInfo.description}</p>
                  </div>
                ) : null}
                {goalSections.successMetric && (
                  <div>
                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Success Metric</h4>
                    <div className="text-sm text-text-secondary leading-relaxed">
                      <MarkdownView content={goalSections.successMetric} compact />
                    </div>
                  </div>
                )}
                {buildInfo.status === 'deployed' && (
                  <div className="rounded-lg border border-success/30 bg-success/5 p-4 mt-2 space-y-2">
                    <p className="text-xs font-medium text-success">Cycle Shipped</p>
                    <p className="text-xs text-text-muted">This cycle has been deployed. Write a RECAP to close it out.</p>
                    {buildInfo.gitEnabled && !buildInfo.prUrl && (
                      <button
                        onClick={() => setShowPRModal(true)}
                        className="py-1.5 px-4 rounded-lg text-xs font-semibold border border-accent/40 text-accent hover:bg-accent/10 transition-colors"
                      >
                        Create PR
                      </button>
                    )}
                    {buildInfo.prUrl && (
                      <a
                        href={buildInfo.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block py-1.5 px-4 rounded-lg text-xs font-semibold text-center border border-success/40 text-success hover:bg-success/10 transition-colors"
                      >
                        View PR #{buildInfo.prNumber}
                      </a>
                    )}
                  </div>
                )}
                {buildInfo.status === 'review' && (
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 mt-2">
                    <p className="text-xs font-medium text-warning">In Review</p>
                    <p className="text-xs text-text-muted mt-1">Check task results, review docs, then click <strong>Ship It!</strong> when ready.</p>
                  </div>
                )}
              </div>
            )}

            {tasks.length > 0 && (
              <div className="p-6 space-y-3">
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Tasks
                  <span className="ml-1.5 text-xs font-normal">({tasks.length})</span>
                </h4>
                <div className="space-y-1.5">
                  {tasks.map(task => (
                    <EditableTaskRow
                      key={task.id}
                      task={task}
                      onPatch={onPatchTask}
                      onExecute={onExecuteTask}
                      onCancel={onCancelTask}
                    />
                  ))}
                </div>
              </div>
            )}

            {buildInfo.status === 'blocked' && (
              <div className="p-6">
                <div className="rounded-lg border border-danger/30 bg-danger/5 p-4">
                  <p className="text-xs font-medium text-danger">This build is blocked.</p>
                  <p className="text-xs text-text-muted mt-1">Resolve the issue and change status to continue.</p>
                </div>
              </div>
            )}

          </>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Build Info</h4>
              <div className="rounded-lg border border-border bg-surface-alt p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Build ID</span>
                  <span className="text-xs text-text-primary" style={{ fontFamily: 'var(--font-mono)' }}>{buildInfo.buildId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Type</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${typeClass}`}>{typeLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Status</span>
                  <StatusBadge status={buildInfo.status} size="sm" />
                </div>
                {buildInfo.totalTasks > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">Tasks</span>
                    <span className="text-xs text-text-primary">{buildInfo.doneTasks}/{buildInfo.totalTasks} done</span>
                  </div>
                )}
              </div>
            </div>

            {onDelete && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-danger uppercase tracking-wider">Danger Zone</h4>
                <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 space-y-2">
                  <p className="text-xs text-text-secondary">
                    Permanently delete this build and all its documents. This action cannot be undone.
                  </p>
                  {!confirmDelete ? (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-danger/40 text-danger hover:bg-danger hover:text-white transition-colors"
                    >
                      Delete this build
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-danger font-medium flex-1">Delete {buildInfo.buildId}?</span>
                      <button
                        onClick={() => { setConfirmDelete(false); onDelete(buildInfo.buildId) }}
                        className="px-2.5 py-1 rounded text-xs font-semibold bg-danger text-white hover:bg-danger/80 transition-colors"
                      >
                        Yes, delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="px-2.5 py-1 rounded text-xs font-semibold border border-border text-text-muted hover:text-text-primary transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Changes Tab */}
        {activeTab === 'changes' && (
          <div className="h-full">
            <DiffViewer
              buildId={buildInfo.buildId}
              files={diffFiles}
              onSelectFile={handleSelectDiffFile}
              selectedFile={selectedDiffFile}
              diff={currentDiff}
              loading={diffLoading}
            />
          </div>
        )}

        {/* Document Tabs */}
        {activeTab !== 'overview' && activeTab !== 'settings' && activeTab !== 'changes' && (() => {
          const tabConfig = availableTabs.find(t => t.key === activeTab)
          if (!tabConfig || !tabConfig.docName) return null
          let content = buildDocs[tabConfig.docName]

          if (!content && tabConfig.docName === 'RECAP.md') {
            const doneCount = tasks.filter(t => t.status === 'review' || t.status === 'deployed').length
            content = [
              `# Recap \u2014 ${buildInfo?.buildId || ''}`,
              '',
              `## Summary`,
              `${buildInfo?.description || 'Describe what this cycle accomplished.'}`,
              '',
              `## Metrics`,
              `- Tasks completed: ${doneCount}/${tasks.length}`,
              `- Cycle status: ${buildInfo?.status || 'unknown'}`,
              '',
              `## What Went Well`,
              `- `,
              '',
              `## What Could Improve`,
              `- `,
              '',
              `## Notes`,
              `- `,
              '',
            ].join('\n')
          }

          if (!content) return null
          return (
            <div className="p-6">
              <EditableDoc
                title={tabConfig.docName}
                content={content}
                onSave={onSaveDoc}
                buildId={buildInfo?.buildId}
                defaultExpanded={true}
              />
            </div>
          )
        })()}
      </div>

      {/* PR Modal */}
      <PRModal
        isOpen={showPRModal}
        onClose={() => setShowPRModal(false)}
        onSubmit={handleCreatePR}
        defaultTitle={buildInfo?.description || `Build ${buildInfo?.buildId}`}
        defaultBody={prDefaultBody}
      />
    </div>
  )
}

export default BuildDetailPanel
