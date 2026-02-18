import { useCallback, useEffect, useMemo, useRef } from 'react'

const MAX_LINES = 2000

const STREAM_COLORS = {
  stderr:  '#e8543e',
  error:   '#e8543e',
  system:  '#f5a623',
  success: '#4ade80',
  warning: '#fbbf24',
  stdout:  '#f0e6d9',
  log:     '#8a7b6f',
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

  const appendToElement = useCallback((el, logEntry) => {
    if (!el) return

    // Remove the "Waiting for output..." placeholder on first real line
    const placeholder = el.querySelector('[data-placeholder]')
    if (placeholder) placeholder.remove()

    const div = document.createElement('div')
    div.className = 'mb-1'

    const stream = logEntry.stream || 'log'
    const color = STREAM_COLORS[stream] || STREAM_COLORS.log
    const prefix = stream === 'stdout' ? '' : `[${stream}] `
    const text = String(logEntry.message || '').trimEnd()

    if (prefix) {
      const span = document.createElement('span')
      span.style.color = color
      span.textContent = prefix
      div.appendChild(span)
      div.appendChild(document.createTextNode(text))
    } else {
      div.style.color = color
      div.textContent = text
    }

    el.appendChild(div)
    lineCountRef.current += 1

    // Prune oldest lines when over cap
    while (lineCountRef.current > MAX_LINES && el.firstChild) {
      if (el.firstChild.hasAttribute?.('data-placeholder')) break
      el.removeChild(el.firstChild)
      lineCountRef.current -= 1
    }

    // Instant auto-scroll (only if user hasn't scrolled up)
    if (!userScrolledUpRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [])

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
