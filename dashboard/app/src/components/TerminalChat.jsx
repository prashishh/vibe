import { useCallback, useEffect, useRef, useState } from 'react'
import { parseCommand } from '../utils/commandParser.js'

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

/**
 * TerminalChat — unified terminal + chat panel (like VS Code integrated terminal).
 *
 * Always visible at the bottom of the workspace. Supports:
 * - Slash commands (/new, /plan, /build, /help, etc.)
 * - Chat messages to the selected build
 * - Streaming output from planning/execution
 * - Agent questions inline in the terminal stream
 *
 * Props:
 *   terminal           - object from useTerminalOutput()
 *   buildId            - current build ID (empty string when none selected)
 *   onSendChat         - (buildId, message) => Promise
 *   onCommand          - (parsedCommand) => Promise
 *   disabled           - boolean (e.g. while planning)
 *   pendingQuestions    - array of question groups
 *   hasLogs            - whether this build has any logs
 *   isPlanning         - whether planning is in progress
 *   runningCount       - number of currently running tasks
 */
function TerminalChat({
  terminal,
  buildId,
  onSendChat,
  onCommand,
  disabled = false,
  pendingQuestions = [],
  hasLogs = false,
  isPlanning = false,
  runningCount = 0,
}) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [panelHeight, setPanelHeight] = useState(280)
  const [isResizing, setIsResizing] = useState(false)
  const textareaRef = useRef(null)
  const resizeStartRef = useRef({ y: 0, height: 0 })
  const prevQuestionsRef = useRef([])
  const welcomeShownRef = useRef(false)

  // Show welcome message on first mount
  useEffect(() => {
    if (!welcomeShownRef.current) {
      welcomeShownRef.current = true
      terminal.appendLine({
        stream: 'system',
        message: 'Describe what you want to build, or type /help for commands.',
        timestamp: new Date().toISOString(),
      })
    }
  }, [terminal])

  // Clear input on build change
  useEffect(() => {
    setMessage('')
  }, [buildId])

  // When new questions arrive, inject them into the terminal stream
  useEffect(() => {
    const allQuestions = collectQuestions(pendingQuestions)
    const prevQuestions = prevQuestionsRef.current
    prevQuestionsRef.current = allQuestions

    // Only inject new questions (not ones we already showed)
    const prevSet = new Set(prevQuestions)
    const newQuestions = allQuestions.filter(q => !prevSet.has(q))

    if (newQuestions.length > 0) {
      for (const q of newQuestions) {
        terminal.appendLine({
          stream: 'question',
          message: q,
          timestamp: new Date().toISOString(),
        })
      }
      // Auto-focus the input when questions arrive
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [pendingQuestions, terminal])

  // Resize handlers
  const handleResizeStart = useCallback((e) => {
    e.preventDefault()
    setIsResizing(true)
    resizeStartRef.current = { y: e.clientY, height: panelHeight }

    const handleMove = (e) => {
      const delta = resizeStartRef.current.y - e.clientY
      const newHeight = Math.max(150, Math.min(600, resizeStartRef.current.height + delta))
      setPanelHeight(newHeight)
    }

    const handleUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }, [panelHeight])

  const handleSend = useCallback(async () => {
    const trimmed = message.trim()
    if (!trimmed || sending) return

    // Check if it's a slash command
    const parsed = parseCommand(trimmed)

    if (parsed && onCommand) {
      // Echo command in terminal
      terminal.appendLine({
        stream: 'user-message',
        message: trimmed,
        timestamp: new Date().toISOString(),
      })
      setMessage('')
      setSending(true)
      try {
        await onCommand(parsed)
      } finally {
        setSending(false)
      }
      return
    }

    // No build selected — treat message as a new cycle (like Claude/Codex: just type and go)
    if (!buildId) {
      terminal.appendLine({
        stream: 'user-message',
        message: trimmed,
        timestamp: new Date().toISOString(),
      })
      setMessage('')
      setSending(true)
      try {
        // Auto-create a new cycle from the message
        await onCommand({ command: 'new', description: trimmed, buildType: 'vibe' })
      } finally {
        setSending(false)
      }
      return
    }

    if (!onSendChat) return

    // Reject chat during planning (but commands still work above)
    if (disabled) {
      terminal.appendLine({
        stream: 'warning',
        message: 'Planning in progress. Chat will be available once planning finishes. Commands (/help) still work.',
        timestamp: new Date().toISOString(),
      })
      return
    }

    // Inject user message into terminal stream
    terminal.appendLine({
      stream: 'user-message',
      message: trimmed,
      timestamp: new Date().toISOString(),
    })

    setMessage('')
    setSending(true)

    try {
      const result = await onSendChat(buildId, trimmed)
      const updatedFiles = result?.updatedFiles || []
      const summary = updatedFiles.length > 0
        ? `Updated ${updatedFiles.join(', ')}`
        : 'Feedback processed (no files changed)'

      terminal.appendLine({
        stream: 'assistant-message',
        message: summary,
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      terminal.appendLine({
        stream: 'error-message',
        message: err.message || 'Failed to process feedback',
        timestamp: new Date().toISOString(),
      })
    } finally {
      setSending(false)
    }
  }, [message, sending, buildId, onSendChat, onCommand, disabled, terminal])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const showLiveIndicator = isPlanning || runningCount > 0 || hasLogs
  const allQuestions = collectQuestions(pendingQuestions)
  const hasOpenQuestions = allQuestions.length > 0

  // Determine placeholder text
  let placeholder
  if (hasOpenQuestions) {
    placeholder = "Answer the agent's questions.."
  } else if (buildId) {
    placeholder = 'Message the agent or type / for commands..'
  } else {
    placeholder = 'What do you want to build? (or type / for commands)'
  }

  return (
    <div
      className="flex-shrink-0 flex flex-col border-t border-border bg-[#0d0f18]"
      style={{ height: `${panelHeight}px` }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className={`h-1 cursor-row-resize flex-shrink-0 transition-colors ${
          isResizing ? 'bg-accent/40' : 'hover:bg-accent/20'
        }`}
      />

      {/* Terminal header bar */}
      <div className="flex items-center gap-3 px-4 py-1.5 bg-[#0d0f18] border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Agent</span>
          {buildId ? (
            <span className="text-[10px] text-accent font-mono font-medium">{buildId}</span>
          ) : (
            <span className="text-[10px] text-text-muted italic">no build selected</span>
          )}
          {showLiveIndicator && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-info animate-pulse" />
              <span className="text-[10px] text-info">
                {isPlanning ? 'planning...' : runningCount > 0 ? `${runningCount} running` : 'live'}
              </span>
            </span>
          )}
        </div>
        {hasOpenQuestions && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning/15 text-warning font-medium">
            {allQuestions.length} question{allQuestions.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Terminal output area — ALWAYS MOUNTED so containerRef is never null */}
      <div
        ref={terminal.containerRef}
        onScroll={terminal.handleScroll}
        className="flex-1 overflow-y-auto px-4 py-2 text-xs whitespace-pre-wrap text-[#e4e6ef] min-h-0"
        style={{ fontFamily: 'var(--font-mono)' }}
      />

      {/* Input area — always visible for commands */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-border/50 bg-[#0d0f18]">
        <div className="flex items-end gap-2">
          <span className="text-accent text-xs font-bold flex-shrink-0 pb-2">&gt;</span>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={sending}
            rows={1}
            className={`flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
              hasOpenQuestions ? 'caret-warning' : 'caret-accent'
            }`}
            style={{
              fontFamily: 'var(--font-mono)',
              minHeight: '28px',
              maxHeight: '120px',
            }}
            onInput={(e) => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent/20 text-accent hover:bg-accent/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {sending ? (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
              </span>
            ) : (
              <span>Enter</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default TerminalChat
