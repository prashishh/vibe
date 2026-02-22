import { useCallback, useEffect, useRef, useState } from 'react'

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

function AgentChat({ buildId, onSendChat, disabled, pendingQuestions = [] }) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState([])
  const [questionsDismissed, setQuestionsDismissed] = useState(false)
  const textareaRef = useRef(null)
  const historyEndRef = useRef(null)

  // Auto-scroll history
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history.length])

  // Clear on build change
  useEffect(() => {
    setHistory([])
    setMessage('')
    setQuestionsDismissed(false)
  }, [buildId])

  // Auto-focus when questions arrive
  useEffect(() => {
    if (pendingQuestions.length > 0 && !questionsDismissed) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [pendingQuestions.length, questionsDismissed])

  const handleSend = useCallback(async () => {
    const trimmed = message.trim()
    if (!trimmed || sending || !onSendChat) return

    setHistory(prev => [...prev, { role: 'user', text: trimmed, time: new Date().toISOString() }])
    setMessage('')
    setSending(true)
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

  const allQuestions = collectQuestions(pendingQuestions)
  const showQuestionsBanner = allQuestions.length > 0 && !questionsDismissed

  return (
    <div className="border-t border-border bg-surface-alt flex-shrink-0">
      {/* Runner questions */}
      {showQuestionsBanner && (
        <div className="px-5 py-3 bg-warning/5 border-b border-warning/20">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-warning mb-2">Agent needs your input:</p>
              <div className="space-y-1.5">
                {allQuestions.map((q, i) => (
                  <div
                    key={i}
                    className="bg-warning/10 rounded-lg px-3 py-2 text-xs text-text-secondary leading-relaxed flex gap-2"
                  >
                    <span className="text-warning flex-shrink-0 font-bold">?</span>
                    <span>{q}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-text-muted mt-2">
                {disabled
                  ? 'Planning is still running. You can reply as soon as it finishes.'
                  : 'Reply below to answer, then the plan will be updated.'}
              </p>
            </div>
            <button
              onClick={() => setQuestionsDismissed(true)}
              className="text-sm text-text-muted hover:text-text-secondary flex-shrink-0"
              title="Dismiss"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Chat history */}
      {history.length > 0 && (
        <div className="max-h-48 overflow-y-auto px-5 py-3 space-y-2">
          {history.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-accent/15 text-text-primary'
                    : msg.role === 'error'
                    ? 'bg-danger/10 text-danger'
                    : 'bg-surface-hover text-success'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={historyEndRef} />
        </div>
      )}

      {/* Input area */}
      <div className="px-5 py-3 flex items-end gap-3">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled ? 'Wait for processing to finish..'
            : showQuestionsBanner ? "Answer the agent's questions.."
            : 'Message the agent..'
          }
          disabled={disabled || sending}
          rows={2}
          className={`flex-1 resize-none rounded-xl border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed ${
            showQuestionsBanner
              ? 'border-warning/40 focus:border-warning focus:ring-warning/30'
              : 'border-border-light focus:border-accent focus:ring-accent/30'
          }`}
          style={{ minHeight: '56px', maxHeight: '200px' }}
          onInput={(e) => {
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'
          }}
        />
        <button
          onClick={handleSend}
          disabled={!message.trim() || disabled || sending}
          className="flex-shrink-0 px-5 py-3 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Sending...
            </span>
          ) : 'Send'}
        </button>
      </div>
    </div>
  )
}

export default AgentChat
