import { useCallback, useEffect, useMemo, useRef } from 'react'

const MAX_LINES = 200000
const MAX_PENDING_ENTRIES = 5000

const STREAM_COLORS = {
  stderr:  '#e8543e',
  error:   '#e8543e',
  system:  '#f5a623',
  success: '#4ade80',
  warning: '#fbbf24',
  stdout:  '#f0e6d9',
  log:     '#8a7b6f',
  'user-message':      '#818cf8',
  'assistant-message':  '#34d399',
  'error-message':      '#f87171',
  question:             '#fbbf24',
}

/**
 * DOM-direct terminal output hook.
 *
 * Bypasses React state/reconciliation for individual log lines —
 * appends directly to a container div for terminal-like speed.
 * Works with any CLI runner (Claude, Codex, Aider, etc.).
 */
export function useTerminalOutput() {
  const containerRef = useRef(null)
  const lineCountRef = useRef(0)
  const userScrolledUpRef = useRef(false)
  const pendingEntriesRef = useRef([])
  const continuationRef = useRef({ stream: null, el: null })

  const isContinuableStream = useCallback(
    (stream) => stream === 'stdout' || stream === 'stderr',
    []
  )

  const createLineElement = useCallback((stream, initialText) => {
    const div = document.createElement('div')
    div.dataset.stream = stream

    const color = STREAM_COLORS[stream] || STREAM_COLORS.log

    // Chat messages get special formatting
    if (stream === 'user-message') {
      div.className = 'my-2 py-1.5 px-3 rounded-lg'
      div.style.cssText = `color: ${color}; background: rgba(99,102,241,0.1); border-left: 3px solid ${color};`
      div.textContent = `▸ ${initialText}`
      return div
    }
    if (stream === 'assistant-message') {
      div.className = 'my-2 py-1.5 px-3 rounded-lg'
      div.style.cssText = `color: ${color}; background: rgba(52,211,153,0.08); border-left: 3px solid ${color};`
      div.textContent = `◂ ${initialText}`
      return div
    }
    if (stream === 'error-message') {
      div.className = 'my-2 py-1.5 px-3 rounded-lg'
      div.style.cssText = `color: ${color}; background: rgba(248,113,113,0.08); border-left: 3px solid ${color};`
      div.textContent = `✗ ${initialText}`
      return div
    }
    if (stream === 'question') {
      div.className = 'my-1 py-1 px-3 rounded'
      div.style.cssText = `color: ${color}; background: rgba(251,191,36,0.08); border-left: 3px solid ${color};`
      div.textContent = `? ${initialText}`
      return div
    }

    div.className = 'mb-1'
    const prefix = stream === 'stdout' ? '' : `[${stream}] `
    div.style.color = color
    div.textContent = `${prefix}${initialText}`
    return div
  }, [])

  const appendToElement = useCallback((el, logEntry) => {
    if (!el) return

    // Remove the "Waiting for output..." placeholder on first real line
    const placeholder = el.querySelector('[data-placeholder]')
    if (placeholder) placeholder.remove()

    const stream = logEntry.stream || 'log'
    const text = String(logEntry.message || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const parts = text.split('\n')
    const hasTrailingNewline = text.endsWith('\n')
    if (hasTrailingNewline) parts.pop()
    if (parts.length === 0) parts.push('')

    let lastLineEl = null
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index]
      const canContinue =
        index === 0 &&
        isContinuableStream(stream) &&
        continuationRef.current.stream === stream &&
        continuationRef.current.el

      if (canContinue) {
        continuationRef.current.el.textContent += part
        lastLineEl = continuationRef.current.el
      } else {
        const div = createLineElement(stream, part)
        el.appendChild(div)
        lineCountRef.current += 1
        lastLineEl = div
      }

      const shouldCloseLine = index < parts.length - 1 || hasTrailingNewline
      if (shouldCloseLine) {
        continuationRef.current = { stream: null, el: null }
      }
    }

    if (isContinuableStream(stream) && !hasTrailingNewline) {
      continuationRef.current = { stream, el: lastLineEl }
    } else if (!isContinuableStream(stream)) {
      continuationRef.current = { stream: null, el: null }
    }

    // Prune oldest lines when over cap
    while (lineCountRef.current > MAX_LINES && el.firstChild) {
      if (el.firstChild.hasAttribute?.('data-placeholder')) break
      if (continuationRef.current.el === el.firstChild) {
        continuationRef.current = { stream: null, el: null }
      }
      el.removeChild(el.firstChild)
      lineCountRef.current -= 1
    }

    // Instant auto-scroll (only if user hasn't scrolled up)
    if (!userScrolledUpRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [createLineElement, isContinuableStream])

  /** Detect whether user has scrolled up (pause auto-scroll). */
  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    userScrolledUpRef.current = !atBottom
  }, [])

  /** Append a single log entry to the terminal container. */
  const appendLine = useCallback((logEntry) => {
    const el = containerRef.current
    if (!el) {
      pendingEntriesRef.current.push(logEntry)
      if (pendingEntriesRef.current.length > MAX_PENDING_ENTRIES) {
        pendingEntriesRef.current.splice(0, pendingEntriesRef.current.length - MAX_PENDING_ENTRIES)
      }
      return
    }
    appendToElement(el, logEntry)
  }, [appendToElement])

  /** Append a batch of log entries (used for loading persisted logs). */
  const appendBatch = useCallback((logEntries) => {
    if (!Array.isArray(logEntries)) return
    for (const entry of logEntries) {
      appendLine(entry)
    }
  }, [appendLine])

  /** Show a placeholder message in the terminal (managed entirely via DOM). */
  const showPlaceholder = useCallback((text) => {
    const el = containerRef.current
    if (!el) return
    // Remove any existing placeholder first
    const existing = el.querySelector('[data-placeholder]')
    if (existing) existing.remove()
    const span = document.createElement('span')
    span.setAttribute('data-placeholder', '')
    span.style.color = '#8a7b6f'
    span.textContent = text
    el.appendChild(span)
  }, [])

  /** Clear all terminal content. */
  const clear = useCallback(() => {
    const el = containerRef.current
    if (el) {
      el.innerHTML = ''
    }
    lineCountRef.current = 0
    userScrolledUpRef.current = false
    pendingEntriesRef.current = []
    continuationRef.current = { stream: null, el: null }
  }, [])

  // Flush any logs received before the terminal container mounted.
  useEffect(() => {
    const el = containerRef.current
    if (!el || pendingEntriesRef.current.length === 0) return
    const queued = pendingEntriesRef.current
    pendingEntriesRef.current = []
    for (const entry of queued) {
      appendToElement(el, entry)
    }
  })

  return useMemo(() => ({
    containerRef,
    handleScroll,
    appendLine,
    appendBatch,
    showPlaceholder,
    clear,
  }), [containerRef, handleScroll, appendLine, appendBatch, showPlaceholder, clear])
}
