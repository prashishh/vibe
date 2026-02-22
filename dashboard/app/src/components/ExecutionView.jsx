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

// ─── Check if doc content is substantive (not just headings/TBD placeholders) ─
function hasSubstantiveContent(content) {
  if (!content) return false
  const stripped = content
    .replace(/^#+\s.*$/gm, '')      // headings
    .replace(/\bTBD\b/gi, '')        // TBD markers
    .replace(/[-\u2013\u2014]/g, '') // dashes
    .replace(/runner did not generate this file/gi, '') // placeholder text
    .replace(/\s+/g, '')             // whitespace
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

// ─── Editable Document (formatted markdown view + raw editor) ────────────────
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
          <span className="text-[10px] text-text-muted">{editing || expanded ? '▾' : '▸'}</span>
          <span className="text-xs font-semibold text-text-secondary">{title}</span>
        </button>
        {!editing ? (
          <button
            onClick={() => { setEditing(true); setExpanded(true) }}
            className="text-[10px] text-accent hover:text-accent-hover font-medium transition-colors"
          >
            Edit
          </button>
        ) : (
          <span className="text-[10px] text-text-muted italic">Editing</span>
        )}
      </div>

      {/* Edit mode — raw textarea */}
      {editing && (
        <div className="px-3 pb-3 space-y-2">
          {buildId && (
            <p className="text-[10px] text-text-muted" style={{ fontFamily: "var(--font-mono)" }}>
              .vibe/builds/{buildId}/{title}
            </p>
          )}
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full min-h-48 max-h-[60vh] p-2.5 rounded-lg border border-border bg-surface-alt text-[11px] text-text-primary leading-relaxed resize-y focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
            style={{ fontFamily: "var(--font-mono)" }}
            spellCheck={false}
          />
          {saveError && (
            <p className="text-[11px] text-danger font-medium">{saveError}</p>
          )}
          <div className="flex items-center gap-2 justify-end">
            <span className="text-[10px] text-text-muted mr-auto">
              {navigator.platform?.includes('Mac') ? '\u2318S' : 'Ctrl+S'} to save · Esc to cancel
            </span>
            <button
              onClick={handleCancel}
              className="px-2.5 py-1 rounded text-[11px] font-medium border border-border text-text-muted hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || draft === content}
              className="px-2.5 py-1 rounded text-[11px] font-semibold bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Collapsed preview — formatted markdown */}
      {!editing && !expanded && (
        <div className="px-3 pb-2 line-clamp-3 overflow-hidden text-xs">
          <MarkdownView content={content} compact />
        </div>
      )}

      {/* Expanded view — formatted markdown */}
      {!editing && expanded && (
        <div className="px-3 pb-3 border-t border-border pt-2 text-xs">
          <MarkdownView content={content} compact />
        </div>
      )}
    </div>
  )
}

// ─── Reusable progress banner ─────────────────────────────────────────────────
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
    <div className={`px-4 py-3 border-b border-border ${t.bg}`}>
      <div className="flex items-center gap-3">
        <div className="relative w-5 h-5 flex-shrink-0">
          <span className={`absolute inset-0 rounded-full border-2 ${t.borderOuter}`} />
          <span className={`absolute inset-0 rounded-full border-2 ${t.borderInner} animate-spin`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold ${t.text}`}>{title}</p>
          <p className="text-[11px] text-text-muted">{subtitle}</p>
        </div>
        <div className="text-[11px] text-text-muted flex-shrink-0">
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

// ─── Task Row — click to expand details, explicit edit ───────────────────────
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
    if (e.key === 'Enter') {
      e.preventDefault()
      handleTitleSave()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setTitleDraft(task.title)
      setEditingTitle(false)
    }
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
    try {
      await onExecute(task.id)
    } finally {
      setExecuting(false)
    }
  }

  const isRunnable = task.status === 'pending' || task.status === 'planning' || task.status === 'blocked'
  const isRunning = task.status === 'in_progress'
  const hasDetails = task.outcome || task.acceptance?.length > 0 || task.files?.length > 0 || task.guardrails?.length > 0

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 space-y-1.5">
      {/* Main row */}
      <div className="flex items-start gap-2">
        {/* Expand chevron + task ID */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-text-muted mt-0.5 flex-shrink-0 flex items-center gap-1 hover:text-text-secondary transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <span className="text-[9px]">{expanded ? '▾' : '▸'}</span>
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
              className="w-full text-xs text-text-primary bg-surface-alt border border-accent/40 rounded px-1.5 py-0.5 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
            />
          ) : (
            <span
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-text-primary leading-snug cursor-pointer hover:text-accent transition-colors"
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
              className="text-[10px] rounded border border-border bg-surface px-1 py-0.5 focus:outline-none focus:border-accent"
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

      {/* Blocked reason */}
      {task.status === 'blocked' && task.blockedReason && (
        <p className="text-[10px] text-danger ml-6 leading-snug">
          ⚠ {task.blockedReason}
        </p>
      )}

      {/* Expanded details */}
      {expanded && !editingTitle && (
        <div className="ml-6 space-y-2 pt-1 border-t border-border/50 mt-1.5">
          {task.outcome && (
            <div className="pt-1.5">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">Outcome</span>
              <p className="text-[11px] text-text-secondary leading-relaxed mt-0.5">{task.outcome}</p>
            </div>
          )}
          {task.risk && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">Risk</span>
              <RiskBadge risk={task.risk} />
            </div>
          )}
          {task.acceptance?.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">Acceptance</span>
              <ul className="mt-0.5 space-y-0.5">
                {task.acceptance.map((item, i) => (
                  <li key={i} className="text-[11px] text-text-secondary flex items-start gap-1.5">
                    <span className="text-text-muted mt-px">☐</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {task.files?.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">Files</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {task.files.map((f, i) => (
                  <code key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-alt text-accent" style={{ fontFamily: "var(--font-mono)" }}>
                    {f}
                  </code>
                ))}
              </div>
            </div>
          )}
          {task.guardrails?.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">Guardrails</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {task.guardrails.map((g, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning font-medium">{g}</span>
                ))}
              </div>
            </div>
          )}
          {/* Edit button */}
          {onPatch && (
            <button
              onClick={(e) => { e.stopPropagation(); setEditingTitle(true); setExpanded(false) }}
              className="text-[10px] px-2 py-0.5 rounded font-medium text-accent hover:bg-accent/10 transition-colors mt-1"
            >
              Edit Title
            </button>
          )}
        </div>
      )}

      {/* Execute / Cancel buttons */}
      {(onExecute || onCancel) && (
        <div className="flex items-center gap-2 ml-6">
          {isRunnable && onExecute && (
            <button
              onClick={handleExecute}
              disabled={executing}
              className="text-[10px] px-2 py-0.5 rounded font-medium bg-info/10 text-info hover:bg-info/20 transition-colors disabled:opacity-50"
            >
              {executing ? 'Starting...' : '▶ Run'}
            </button>
          )}
          {isRunning && onCancel && (
            <button
              onClick={() => onCancel(task.id)}
              className="text-[10px] px-2 py-0.5 rounded font-medium bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
            >
              ■ Cancel
            </button>
          )}
          {isRunning && (
            <span className="text-[10px] text-info animate-pulse">Running...</span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Build Chat — feedback interface to modify build docs ───────────────────
function BuildChat({ buildId, onSendChat, disabled, pendingQuestions = [] }) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState([])
  const [expanded, setExpanded] = useState(false)
  const [questionsDismissed, setQuestionsDismissed] = useState(false)
  const textareaRef = useRef(null)
  const historyEndRef = useRef(null)

  // Auto-scroll history when new messages arrive
  useEffect(() => {
    if (expanded) {
      historyEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [history.length, expanded])

  // Clear history when build changes
  useEffect(() => {
    setHistory([])
    setMessage('')
    setQuestionsDismissed(false)
  }, [buildId])

  // Auto-expand chat and focus when new questions arrive
  useEffect(() => {
    if (pendingQuestions.length > 0 && !questionsDismissed) {
      setExpanded(true)
      // Focus the textarea so user can start typing immediately
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [pendingQuestions.length, questionsDismissed])

  const handleSend = useCallback(async () => {
    const trimmed = message.trim()
    if (!trimmed || sending || !onSendChat) return

    setHistory(prev => [...prev, { role: 'user', text: trimmed, time: new Date().toISOString() }])
    setMessage('')
    setSending(true)
    setExpanded(true)
    setQuestionsDismissed(true)

    try {
      const result = await onSendChat(buildId, trimmed)
      const updatedFiles = result?.updatedFiles || []
      const summary = updatedFiles.length > 0
        ? `Updated ${updatedFiles.join(', ')}`
        : 'Feedback processed (no files changed)'
      setHistory(prev => [...prev, { role: 'assistant', text: summary, time: new Date().toISOString() }])
    } catch (err) {
      setHistory(prev => [...prev, { role: 'error', text: err.message || 'Failed to process feedback', time: new Date().toISOString() }])
    } finally {
      setSending(false)
    }
  }, [message, sending, onSendChat, buildId])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!onSendChat) return null

  // Flatten all questions from all pending question events
  const allQuestions = collectQuestions(pendingQuestions)
  const showQuestionsBanner = allQuestions.length > 0 && !questionsDismissed

  return (
    <div className="border-t-2 border-border">
      {/* Runner questions banner — shows when runner asked clarifying questions */}
      {showQuestionsBanner && (
        <div className="px-3 py-2.5 bg-warning/5 border-b border-warning/20">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-warning mb-1">Runner needs input:</p>
              <ul className="space-y-0.5">
                {allQuestions.map((q, i) => (
                  <li key={i} className="text-[11px] text-text-secondary leading-relaxed flex gap-1.5">
                    <span className="text-warning flex-shrink-0">?</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-text-muted mt-1.5">
                {disabled
                  ? 'Planning is still running. You can reply as soon as it finishes.'
                  : 'Reply below to answer, then the plan will be updated.'}
              </p>
            </div>
            <button
              onClick={() => setQuestionsDismissed(true)}
              className="text-[10px] text-text-muted hover:text-text-secondary flex-shrink-0 mt-0.5"
              title="Dismiss"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Chat history (expandable) */}
      {expanded && history.length > 0 && (
        <div className="max-h-40 overflow-y-auto px-3 py-2 space-y-1.5 bg-surface-alt/50">
          {history.map((msg, i) => (
            <div key={i} className={`text-[11px] leading-relaxed ${
              msg.role === 'user' ? 'text-text-primary' :
              msg.role === 'error' ? 'text-danger' :
              'text-success'
            }`}>
              <span className="font-semibold">
                {msg.role === 'user' ? 'You' : msg.role === 'error' ? 'Error' : 'System'}:
              </span>{' '}
              {msg.text}
            </div>
          ))}
          <div ref={historyEndRef} />
        </div>
      )}

      {/* Input area */}
      <div className="px-3 py-2.5 flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled ? 'Wait for processing to finish..'
            : showQuestionsBanner ? 'Answer the runner\'s questions..'
            : 'Update plan, tasks, or docs..'
          }
          disabled={disabled || sending}
          rows={1}
          className={`flex-1 resize-none rounded-lg border bg-surface px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed ${
            showQuestionsBanner
              ? 'border-warning/40 focus:border-warning focus:ring-warning/30'
              : 'border-border focus:border-accent focus:ring-accent/30'
          }`}
          style={{ minHeight: '32px', maxHeight: '80px' }}
          onInput={(e) => {
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'
          }}
        />
        <button
          onClick={handleSend}
          disabled={!message.trim() || disabled || sending}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Updating...
            </span>
          ) : 'Send'}
        </button>
      </div>

      {/* Toggle history */}
      {history.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-center text-[10px] text-text-muted hover:text-text-secondary py-1 transition-colors"
        >
          {expanded ? 'Hide history' : `Show history (${history.length})`}
        </button>
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

// ─── Main ExecutionView ───────────────────────────────────────────────────────
function ExecutionView({
  terminal,
  hasLogs = false,
  onClose,
  onDelete,
  onSaveDoc,
  onPatchTask,
  onExecuteTask,
  onCancelTask,
  onAction,
  onSendChat,
  onRefreshBuilds,
  buildInfo,
  tasks = [],
  buildDocs = {},
  isPlanning = false,
  pendingQuestions = [],
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const chatAnchorRef = useRef(null)

  // ── Diff / Changes tab state ──────────────────────────────────────────────
  const [diffFiles, setDiffFiles] = useState([])
  const [selectedDiffFile, setSelectedDiffFile] = useState(null)
  const [currentDiff, setCurrentDiff] = useState(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const diffAbortRef = useRef(null)

  // ── PR modal state ────────────────────────────────────────────────────────
  const [showPRModal, setShowPRModal] = useState(false)

  // Compute available tabs dynamically from buildDocs (only substantive content)
  const availableTabs = useMemo(() => {
    const tabs = [{ key: 'overview', label: 'Overview' }]
    for (const mapping of DOC_TAB_MAP) {
      if (hasSubstantiveContent(buildDocs[mapping.docName])) {
        tabs.push(mapping)
      } else if (
        mapping.docName === 'RECAP.md' &&
        (buildInfo?.status === 'deployed' || buildInfo?.status === 'review')
      ) {
        // Always show Recap tab in Review/Shipped so user can write it
        tabs.push(mapping)
      }
    }
    // Add any unknown docs not in DOC_TAB_MAP
    const knownDocNames = new Set(DOC_TAB_MAP.map(m => m.docName))
    Object.keys(buildDocs).forEach(name => {
      if (!knownDocNames.has(name) && hasSubstantiveContent(buildDocs[name])) {
        tabs.push({ key: `doc-${name}`, docName: name, label: name.replace('.md', '') })
      }
    })
    // Changes tab — visible in Review/Shipped when git is enabled
    if (
      (buildInfo?.status === 'review' || buildInfo?.status === 'deployed') &&
      buildInfo?.gitEnabled
    ) {
      tabs.splice(tabs.length, 0, { key: 'changes', label: 'Changes' })
    }
    // Settings tab always at the end
    tabs.push({ key: 'settings', label: 'Settings' })
    return tabs
  }, [buildDocs, buildInfo?.status, buildInfo?.gitEnabled])

  // Reset tab to overview if current tab disappears (doc removed, changes tab gone, etc.)
  useEffect(() => {
    if (activeTab === 'overview') return
    const tabExists = availableTabs.some(t => t.key === activeTab)
    if (!tabExists) setActiveTab('overview')
  }, [availableTabs, activeTab])

  // Load diff file list when Changes tab is activated
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

  // Load diff content when a file is selected
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

  // PR creation handler — calls /api/git/builds/:buildId/pr
  const handleCreatePR = useCallback(async ({ title, body, base }) => {
    const res = await fetch(`/api/git/builds/${buildInfo.buildId}/pr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, base }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'PR creation failed')
    // Refresh builds so prUrl / prNumber appears in buildInfo
    if (onRefreshBuilds) onRefreshBuilds()
    return data
  }, [buildInfo?.buildId, onRefreshBuilds])

  // Default PR body — use RECAP.md content if available
  const prDefaultBody = useMemo(() => {
    const recap = buildDocs['RECAP.md']
    if (recap && recap.length > 50) return recap.slice(0, 500)
    const taskList = (tasks || []).map(t => `- ${t.id}: ${t.title}`).join('\n')
    return `## Changes\n\nBuild ${buildInfo?.buildId || ''}.\n\n## Tasks\n\n${taskList}`
  }, [buildDocs, buildInfo?.buildId, tasks])

  // Parse GOAL.md for overview summary
  const goalSections = useMemo(
    () => parseGoalSections(buildDocs['GOAL.md']),
    [buildDocs]
  )

  // Auto-scroll is now handled by useTerminalOutput (instant scrollTop)

  if (!buildInfo) {
    return (
      <div className="rounded-xl border-2 border-border bg-surface-alt p-5 h-full flex flex-col items-center justify-center">
        <p className="text-sm text-text-muted">Select a card to view details.</p>
      </div>
    )
  }

  // Consistent type labels + colored badge (matches KanbanCard)
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
  const runnerQuestions = useMemo(() => collectQuestions(pendingQuestions), [pendingQuestions])
  const hasOpenQuestions = Boolean(
    buildInfo?.needsInput ||
    buildInfo?.hasOpenQuestions ||
    (buildInfo?.openQuestionsCount || 0) > 0 ||
    (buildInfo?.needsInputQuestions || []).length > 0 ||
    runnerQuestions.length > 0
  )
  const showLiveOutput = hasLogs || isPlanning || runningCount > 0

  return (
    <div className="rounded-xl border-2 border-border bg-surface-alt overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b-2 border-border flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] text-text-muted truncate" style={{ fontFamily: "var(--font-mono)" }}>{buildInfo.buildId}</p>
          <h3 className="text-sm font-semibold text-text-primary truncate">{buildInfo.description || 'Untitled'}</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-lg leading-none flex-shrink-0"
            title="Close panel"
          >
            &times;
          </button>
        )}
      </div>

      {/* Build info bar */}
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-3 flex-wrap">
        <StatusBadge status={buildInfo.status} size="sm" />
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${typeClass}`}>
          {typeLabel}
        </span>
        {buildInfo.totalTasks > 0 && (
          <span className="text-[11px] text-text-muted ml-auto">
            {buildInfo.doneTasks}/{buildInfo.totalTasks} done
          </span>
        )}
        {runningCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-info/10 text-info font-medium">
            {runningCount} running
          </span>
        )}
        {blockedCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-danger/10 text-danger font-medium">
            {blockedCount} blocked
          </span>
        )}
        {hasOpenQuestions && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning font-semibold">
            Open Questions
          </span>
        )}
      </div>

      {/* Action buttons — one per stage */}
      {onAction && buildInfo.status === 'pending' && !isPlanning && (
        <div className="px-4 py-2.5 border-b border-border">
          <button
            onClick={() => onAction(buildInfo.buildId, 'planning', buildInfo.status)}
            className="w-full py-2 rounded-lg text-xs font-semibold bg-[#7c3aed] text-white hover:bg-[#7c3aed]/90 transition-colors"
          >
            Start Planning
          </button>
        </div>
      )}
      {onAction && buildInfo.status === 'planning' && !isPlanning && (
        <div className="px-4 py-2.5 border-b border-border">
          {hasOpenQuestions ? (
            <button
              disabled
              className="w-full py-2 rounded-lg text-xs font-semibold border border-warning/40 text-warning bg-warning/5 cursor-not-allowed"
            >
              Answer Open Questions First
            </button>
          ) : (
            <button
              onClick={() => onAction(buildInfo.buildId, 'in_progress', buildInfo.status)}
              className="w-full py-2 rounded-lg text-xs font-semibold bg-info text-white hover:bg-info/90 transition-colors"
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
          <div className="px-4 py-2.5 border-b border-border space-y-2">
            {hasUnfinished && (
              <button
                onClick={() => onAction(buildInfo.buildId, 'in_progress', buildInfo.status)}
                className="w-full py-2 rounded-lg text-xs font-semibold bg-info text-white hover:bg-info/90 transition-colors"
              >
                ▶ Run Tasks ({pendingCount} pending{blockedCountLocal > 0 ? `, ${blockedCountLocal} blocked` : ''})
              </button>
            )}
            <button
              onClick={() => onAction(buildInfo.buildId, 'review', buildInfo.status)}
              className={`w-full py-2 rounded-lg text-xs font-semibold transition-colors ${
                hasUnfinished
                  ? 'border border-warning/40 text-warning hover:bg-warning hover:text-white'
                  : 'bg-warning text-white hover:bg-warning/90'
              }`}
            >
              Start Review
            </button>
          </div>
        )
      })()}
      {onAction && buildInfo.status === 'review' && (
        <div className="px-4 py-2.5 border-b border-border space-y-2">
          <button
            onClick={() => onAction(buildInfo.buildId, 'deployed', buildInfo.status)}
            className="w-full py-2 rounded-lg text-xs font-semibold bg-success text-white hover:bg-success/90 transition-colors"
          >
            Ship It!
          </button>
          {buildInfo.gitEnabled && !buildInfo.prUrl && (
            <button
              onClick={() => setShowPRModal(true)}
              className="w-full py-2 rounded-lg text-xs font-semibold border-2 border-accent/40 text-accent hover:bg-accent/10 transition-colors"
            >
              Create PR
            </button>
          )}
          {buildInfo.prUrl && (
            <a
              href={buildInfo.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-2 rounded-lg text-xs font-semibold text-center border-2 border-success/40 text-success hover:bg-success/10 transition-colors"
            >
              View PR #{buildInfo.prNumber}
            </a>
          )}
        </div>
      )}

      {/* Progress banners — one per active phase */}
      {isPlanning && (
        <ProgressBanner
          theme="warning"
          title="Planning in progress"
          subtitle="Reading the project and figuring out what to do..."
        />
      )}
      {!isPlanning && buildInfo.status === 'in_progress' && runningCount > 0 && (
        <ProgressBanner
          theme="info"
          title={`Building — ${runningCount} task${runningCount > 1 ? 's' : ''} running`}
          subtitle={`${tasks.filter(t => t.status === 'review' || t.status === 'deployed').length}/${tasks.length} tasks complete`}
        />
      )}

      {runnerQuestions.length > 0 && (
        <div className="px-4 py-3 border-b border-warning/25 bg-warning/5">
          <p className="text-xs font-semibold text-warning">
            Runner asked {runnerQuestions.length} question{runnerQuestions.length === 1 ? '' : 's'}
          </p>
          <p className="text-[11px] text-text-muted mt-1">
            {isPlanning
              ? 'Questions are captured. Reply in chat once planning finishes.'
              : 'Reply in chat to update the plan based on these questions.'}
          </p>
          {!isPlanning && (
            <button
              onClick={() => chatAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="mt-2 text-[11px] font-semibold text-accent hover:text-accent-hover transition-colors"
            >
              Jump to response box
            </button>
          )}
        </div>
      )}

      {/* Tab bar — horizontally scrollable when many tabs */}
      <div className="flex border-b-2 border-border overflow-x-auto">
        {availableTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-shrink-0 px-4 py-2.5 text-xs font-semibold transition-colors relative whitespace-nowrap ${
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

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Overview Tab ───────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <>
            {buildInfo.status === 'pending' && !isPlanning && (
              <div className="p-4">
                <div className="rounded-lg border-2 border-border bg-surface p-4 text-center space-y-2">
                  <p className="text-sm font-medium text-text-primary">Backlog</p>
                  <p className="text-xs text-text-muted">Drag this card to <strong>Planning</strong> or click <strong>Start Planning</strong> to generate build documents and tasks.</p>
                </div>
              </div>
            )}

            {/* Intent & Success Metric — compact summary from GOAL.md */}
            {buildInfo.status !== 'pending' && (
              <div className="p-4 pb-0 space-y-2">
                {goalSections.intent ? (
                  <div>
                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-0.5">Intent</h4>
                    <div className="text-xs text-text-secondary leading-relaxed">
                      <MarkdownView content={goalSections.intent} compact />
                    </div>
                  </div>
                ) : buildInfo.description ? (
                  <div>
                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-0.5">Description</h4>
                    <p className="text-xs text-text-secondary leading-relaxed">{buildInfo.description}</p>
                  </div>
                ) : null}
                {goalSections.successMetric && (
                  <div>
                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-0.5">Success Metric</h4>
                    <div className="text-xs text-text-secondary leading-relaxed">
                      <MarkdownView content={goalSections.successMetric} compact />
                    </div>
                  </div>
                )}
                {/* Shipped summary */}
                {buildInfo.status === 'deployed' && (
                  <div className="rounded-lg border-2 border-success/30 bg-success/5 p-3 mt-2 space-y-2">
                    <p className="text-xs font-medium text-success">Cycle Shipped</p>
                    <p className="text-xs text-text-muted">This cycle has been deployed. Write a RECAP to close it out — switch to the Recap tab.</p>
                    {buildInfo.gitEnabled && !buildInfo.prUrl && (
                      <button
                        onClick={() => setShowPRModal(true)}
                        className="w-full py-1.5 rounded-lg text-[11px] font-semibold border border-accent/40 text-accent hover:bg-accent/10 transition-colors"
                      >
                        Create PR
                      </button>
                    )}
                    {buildInfo.prUrl && (
                      <a
                        href={buildInfo.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full py-1.5 rounded-lg text-[11px] font-semibold text-center border border-success/40 text-success hover:bg-success/10 transition-colors"
                      >
                        View PR #{buildInfo.prNumber}
                      </a>
                    )}
                  </div>
                )}
                {/* Review context */}
                {buildInfo.status === 'review' && (
                  <div className="rounded-lg border-2 border-warning/30 bg-warning/5 p-3 mt-2">
                    <p className="text-xs font-medium text-warning">In Review</p>
                    <p className="text-xs text-text-muted mt-1">Check task results, review docs, then click <strong>Ship It!</strong> or drag back to Building if changes are needed.</p>
                  </div>
                )}
              </div>
            )}

            {tasks.length > 0 && (
              <div className="p-4 space-y-3">
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Tasks
                  <span className="ml-1.5 text-[10px] font-normal">({tasks.length})</span>
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
              <div className="p-4">
                <div className="rounded-lg border-2 border-danger/30 bg-danger/5 p-3">
                  <p className="text-xs font-medium text-danger">This build is blocked.</p>
                  <p className="text-xs text-text-muted mt-1">Resolve the issue and drag it back to the appropriate column.</p>
                </div>
              </div>
            )}

            {/* Live Output — DOM-direct terminal rendering for zero-lag streaming */}
            {showLiveOutput && (
              <section className="p-4">
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Live Output
                </h4>
                <div
                  ref={terminal.containerRef}
                  onScroll={terminal.handleScroll}
                  className="bg-[#1e1510] rounded-lg border-2 border-[#3a2e24] p-3 min-h-32 max-h-[50vh] overflow-y-auto text-xs whitespace-pre-wrap text-[#f0e6d9]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {/* No React children here — useTerminalOutput manages this div's
                      contents via direct DOM manipulation. Mixing React children
                      with imperative DOM ops causes removeChild crashes. */}
                </div>
              </section>
            )}
          </>
        )}

        {/* ── Settings Tab ───────────────────────────────────────── */}
        {activeTab === 'settings' && (
          <div className="p-4 space-y-6">
            {/* Cycle info */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Cycle Info</h4>
              <div className="rounded-lg border border-border bg-surface p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-text-muted">Cycle ID</span>
                  <span className="text-[11px] text-text-primary" style={{ fontFamily: "var(--font-mono)" }}>{buildInfo.buildId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-text-muted">Type</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${typeClass}`}>{typeLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-text-muted">Status</span>
                  <StatusBadge status={buildInfo.status} size="sm" />
                </div>
                {buildInfo.totalTasks > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-text-muted">Tasks</span>
                    <span className="text-[11px] text-text-primary">{buildInfo.doneTasks}/{buildInfo.totalTasks} done</span>
                  </div>
                )}
              </div>
            </div>

            {/* Danger zone */}
            {onDelete && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-danger uppercase tracking-wider">Danger Zone</h4>
                <div className="rounded-lg border-2 border-danger/30 bg-danger/5 p-3 space-y-2">
                  <p className="text-xs text-text-secondary">
                    Permanently delete this build and all its documents. This action cannot be undone.
                  </p>
                  {!confirmDelete ? (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border-2 border-danger/40 text-danger hover:bg-danger hover:text-white transition-colors"
                    >
                      Delete this build
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-danger font-medium flex-1">Delete {buildInfo.buildId}?</span>
                      <button
                        onClick={() => { setConfirmDelete(false); onDelete(buildInfo.buildId); }}
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

        {/* ── Changes Tab ────────────────────────────────────────── */}
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

        {/* ── Document Tabs — each renders a single doc with edit capability ── */}
        {activeTab !== 'overview' && activeTab !== 'settings' && activeTab !== 'changes' && (() => {
          const tabConfig = availableTabs.find(t => t.key === activeTab)
          if (!tabConfig || !tabConfig.docName) return null
          let content = buildDocs[tabConfig.docName]

          // For RECAP.md, provide a starter template if empty
          if (!content && tabConfig.docName === 'RECAP.md') {
            const doneCount = tasks.filter(t => t.status === 'review' || t.status === 'deployed').length
            content = [
              `# Recap — ${buildInfo?.buildId || ''}`,
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
            <div className="p-4">
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

      {/* Build Chat — persistent at bottom of sidebar */}
      {(buildInfo.status !== 'pending' || runnerQuestions.length > 0) && (
        <div ref={chatAnchorRef}>
        <BuildChat
          buildId={buildInfo.buildId}
          onSendChat={onSendChat}
          disabled={isPlanning}
          pendingQuestions={pendingQuestions}
        />
        </div>
      )}

      {/* PR Modal — portal-like, renders outside the scroll container */}
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

export default ExecutionView
