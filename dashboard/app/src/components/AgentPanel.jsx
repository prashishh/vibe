import { useCallback, useEffect, useRef, useState } from 'react'
import MarkdownView from './MarkdownView.jsx'
import { parseCommand } from '../utils/commandParser.js'
import { collectQuestions } from '../utils/questionHelpers.js'
import { fetchLLMConfig, saveLLMConfig } from '../hooks/useTaskAPI.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ts) {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

const STREAM_COLORS = {
  stdout: 'text-text-primary',
  stderr: 'text-danger',
  error: 'text-danger',
  system: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  log: 'text-text-muted',
}

const ACTIVITY_ICONS = {
  'tool-use': '\u2699',
  'file-updated': '\u2192',
  thinking: '\u2026',
  cost: '$',
  error: '\u2717',
  system: '\u2192',
}

const RUNNER_DISPLAY = {
  claude: { label: 'Claude', icon: '\u2726' },
  codex: { label: 'Codex', icon: '\u25cb' },
  gemini: { label: 'Gemini', icon: '\u2666' },
}

// ── Sub-components ───────────────────────────────────────────────────────────

function UserMessage({ message }) {
  return (
    <div className="py-3 pl-4 border-l-2 border-accent/40">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold text-text-secondary">You</span>
        <span className="text-xs text-text-muted">{formatTime(message.timestamp)}</span>
      </div>
      <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{message.content}</p>
    </div>
  )
}

function AssistantMessage({ message }) {
  const [activityOpen, setActivityOpen] = useState(false)
  const activity = message.activity || []
  const hasActivity = activity.length > 0

  return (
    <div className="py-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-semibold text-accent">Agent</span>
        <span className="text-xs text-text-muted">{formatTime(message.timestamp)}</span>
      </div>
      <div className="text-sm">
        <MarkdownView content={message.content} compact />
      </div>
      {hasActivity && (
        <div className="mt-2">
          <button
            onClick={() => setActivityOpen(!activityOpen)}
            className="text-xs text-text-muted hover:text-text-secondary flex items-center gap-1 transition-colors"
          >
            <span className="text-[10px]">{activityOpen ? '\u25be' : '\u25b8'}</span>
            <span>{activity.length} step{activity.length !== 1 ? 's' : ''}</span>
          </button>
          {activityOpen && (
            <div className="mt-1.5 pl-3 border-l border-border/60 space-y-0.5">
              {activity.map((item, i) => (
                <ActivityItem key={i} item={item} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ActivityItem({ item }) {
  const icon = ACTIVITY_ICONS[item.type] || '\u00b7'
  return (
    <div className="flex items-start gap-1.5 text-xs text-text-muted leading-relaxed">
      <span className="flex-shrink-0 w-3 text-center">{icon}</span>
      <span className="font-mono break-all">{item.detail}</span>
    </div>
  )
}

function SystemMessage({ message }) {
  return (
    <div className="py-2 text-xs text-text-muted leading-relaxed whitespace-pre-wrap">
      {message.content}
    </div>
  )
}

/** Live streaming output from the CLI runner */
function LiveOutput({ lines }) {
  const scrollRef = useRef(null)

  // Auto-scroll live output to bottom as new lines arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines.length])

  if (!lines || lines.length === 0) return null

  return (
    <div className="py-2">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-pulse" />
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Live Output</span>
      </div>
      <div
        ref={scrollRef}
        className="rounded-md bg-surface-alt/50 border border-border/30 p-2.5 max-h-[400px] overflow-y-auto font-mono text-xs leading-relaxed"
      >
        {lines.map((line, i) => (
          <div key={i} className={`${STREAM_COLORS[line.stream] || 'text-text-muted'} whitespace-pre-wrap break-words`}>
            {line.message}
          </div>
        ))}
      </div>
    </div>
  )
}

function QuestionsBanner({ questions }) {
  if (!questions || questions.length === 0) return null
  return (
    <div className="mx-4 mb-2 p-3 rounded-lg bg-warning/5 border border-warning/20">
      <p className="text-xs font-semibold text-warning mb-1.5">Agent needs your input:</p>
      <div className="space-y-1">
        {questions.map((q, i) => (
          <div key={i} className="text-sm text-text-secondary leading-relaxed flex gap-2">
            <span className="text-warning flex-shrink-0">?</span>
            <span>{q}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Runner/model switcher dropdown */
function RunnerSwitcher({ currentRunner, availableRunners, onSwitch }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const display = RUNNER_DISPLAY[currentRunner] || { label: currentRunner, icon: '\u25cb' }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-surface-alt border border-border/50 hover:border-accent/40 transition-colors"
      >
        <span>{display.icon}</span>
        <span>{display.label}</span>
        <span className="text-[10px] text-text-muted">{open ? '\u25b4' : '\u25be'}</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-surface border border-border rounded-lg shadow-lg py-1 min-w-[150px]">
          {availableRunners.map(runner => {
            const rd = RUNNER_DISPLAY[runner] || { label: runner, icon: '\u25cb' }
            const isActive = runner === currentRunner
            return (
              <button
                key={runner}
                onClick={() => { onSwitch(runner); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                  isActive
                    ? 'text-accent bg-accent/10'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-alt'
                }`}
              >
                <span>{rd.icon}</span>
                <span>{rd.label}</span>
                {isActive && <span className="ml-auto text-accent text-xs">\u2713</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

function AgentPanel({
  messages = [],
  liveLines = [],
  buildId,
  onSendMessage,
  onCommand,
  isThinking = false,
  pendingQuestions = [],
  isPlanning = false,
  runningCount = 0,
}) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [panelWidth, setPanelWidth] = useState(420)
  const [isResizing, setIsResizing] = useState(false)
  const [currentRunner, setCurrentRunner] = useState('claude')
  const [availableRunners, setAvailableRunners] = useState(['claude'])
  const threadEndRef = useRef(null)
  const textareaRef = useRef(null)
  const resizeStartRef = useRef({ x: 0, width: 0 })

  // Load runner config on mount
  useEffect(() => {
    fetchLLMConfig().then(config => {
      if (config?.execution?.preferredRunner) {
        setCurrentRunner(config.execution.preferredRunner)
      }
      if (config?.execution?.runners) {
        const enabled = Object.entries(config.execution.runners)
          .filter(([, v]) => v.enabled)
          .map(([k]) => k)
        if (enabled.length > 0) setAvailableRunners(enabled)
      }
    }).catch(() => {})
  }, [])

  // Auto-scroll on new messages, live lines, or thinking state change
  // Use a ref to track if user has scrolled up manually
  const threadContainerRef = useRef(null)
  const shouldAutoScroll = useRef(true)

  const handleThreadScroll = useCallback(() => {
    const el = threadContainerRef.current
    if (!el) return
    // If user scrolled more than 80px from the bottom, pause auto-scroll
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    shouldAutoScroll.current = distFromBottom < 80
  }, [])

  useEffect(() => {
    if (shouldAutoScroll.current) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, liveLines.length, isThinking])

  // Clear input on build change
  useEffect(() => {
    setInput('')
  }, [buildId])

  // Focus input when questions arrive
  const allQuestions = collectQuestions(pendingQuestions)
  useEffect(() => {
    if (allQuestions.length > 0) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [allQuestions.length])

  // ── Resize (horizontal for right panel) ──────────────────────────────────

  const handleResizeStart = useCallback((e) => {
    e.preventDefault()
    setIsResizing(true)
    resizeStartRef.current = { x: e.clientX, width: panelWidth }

    const handleMove = (ev) => {
      const delta = resizeStartRef.current.x - ev.clientX
      const newWidth = Math.max(300, Math.min(700, resizeStartRef.current.width + delta))
      setPanelWidth(newWidth)
    }

    const handleUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }, [panelWidth])

  // ── Runner switch ────────────────────────────────────────────────────────

  const handleRunnerSwitch = useCallback(async (runner) => {
    setCurrentRunner(runner)
    try {
      const config = await fetchLLMConfig()
      config.execution.preferredRunner = runner
      await saveLLMConfig(config)
    } catch (err) {
      console.error('Failed to save runner preference:', err)
    }
  }, [])

  // ── Send ──────────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || sending) return

    // Slash commands (power-user feature)
    const parsed = parseCommand(trimmed)
    if (parsed && onCommand) {
      setInput('')
      setSending(true)
      try {
        await onCommand(parsed)
      } finally {
        setSending(false)
      }
      return
    }

    // No build selected — auto-create a new cycle
    if (!buildId) {
      setInput('')
      setSending(true)
      try {
        await onCommand({ command: 'new', description: trimmed, buildType: 'vibe' })
      } finally {
        setSending(false)
      }
      return
    }

    // Regular message to current build
    if (!onSendMessage) return
    setInput('')
    setSending(true)
    try {
      await onSendMessage(trimmed)
    } finally {
      setSending(false)
    }
  }, [input, sending, buildId, onSendMessage, onCommand])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Placeholder ───────────────────────────────────────────────────────────

  let placeholder
  if (allQuestions.length > 0) {
    placeholder = "Answer the agent's questions..."
  } else if (buildId) {
    placeholder = 'Message the agent...'
  } else {
    placeholder = 'Describe what you want to build...'
  }

  const showStatus = isPlanning || runningCount > 0

  return (
    <div
      className="flex-shrink-0 flex flex-col border-l border-border bg-surface h-full"
      style={{ width: `${panelWidth}px` }}
    >
      {/* Resize handle (left edge — drag to resize horizontally) */}
      <div
        onMouseDown={handleResizeStart}
        className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 transition-colors ${
          isResizing ? 'bg-accent/40' : 'hover:bg-accent/20'
        }`}
        style={{ position: 'absolute' }}
      />

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 flex-shrink-0">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Agent</span>
        {buildId && (
          <span className="text-xs text-accent font-mono font-medium truncate max-w-[100px]">{buildId}</span>
        )}
        {showStatus && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-info animate-pulse" />
            <span className="text-xs text-info">
              {isPlanning ? 'planning...' : `${runningCount} running`}
            </span>
          </span>
        )}
        <div className="ml-auto">
          <RunnerSwitcher
            currentRunner={currentRunner}
            availableRunners={availableRunners}
            onSwitch={handleRunnerSwitch}
          />
        </div>
      </div>

      {/* Message thread */}
      <div ref={threadContainerRef} onScroll={handleThreadScroll} className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
        {messages.length === 0 && !buildId && !isThinking && liveLines.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-text-secondary mb-1">What do you want to build?</p>
            <p className="text-xs text-text-muted">
              Describe your idea, and the agent will plan and build it.
            </p>
          </div>
        )}
        {messages.length === 0 && buildId && !isThinking && liveLines.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-text-muted">
              Send a message to modify this build.
            </p>
          </div>
        )}

        <div className="divide-y divide-border/30">
          {messages.map((msg) => {
            switch (msg.role) {
              case 'user':
                return <UserMessage key={msg.id} message={msg} />
              case 'assistant':
                return <AssistantMessage key={msg.id} message={msg} />
              case 'system':
                return <SystemMessage key={msg.id} message={msg} />
              default:
                return null
            }
          })}
        </div>

        {/* Live CLI output — streamed in real time, no filtering */}
        {liveLines.length > 0 && <LiveOutput lines={liveLines} />}
        {isThinking && liveLines.length === 0 && (
          <div className="py-3 flex items-center gap-2 text-xs text-text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-pulse" />
            <span>Agent is working...</span>
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      {/* Questions banner */}
      <QuestionsBanner questions={allQuestions} />

      {/* Input area */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-border/50">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={sending}
            rows={1}
            className={`flex-1 resize-none bg-surface-alt rounded-lg border px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
              allQuestions.length > 0
                ? 'border-warning/40 focus:border-warning focus:ring-warning/30'
                : 'border-border focus:border-accent focus:ring-accent/30'
            }`}
            style={{ minHeight: '40px', maxHeight: '120px' }}
            onInput={(e) => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="flex-shrink-0 p-2.5 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Send"
          >
            {sending ? (
              <span className="inline-block w-4 h-4 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AgentPanel
