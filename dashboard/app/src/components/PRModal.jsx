import { useEffect, useRef, useState } from 'react'

/**
 * PRModal — dialog to create a GitHub PR.
 *
 * Props:
 *   isOpen        boolean
 *   onClose       () => void
 *   onSubmit      ({ title, body, base }) => Promise<{ url, number }>
 *   defaultTitle  string
 *   defaultBody   string
 */
export default function PRModal({ isOpen, onClose, onSubmit, defaultTitle = '', defaultBody = '' }) {
  const [title, setTitle] = useState(defaultTitle)
  const [body, setBody] = useState(defaultBody)
  const [base, setBase] = useState('main')
  const [submitting, setSubmitting] = useState(false)
  const [prUrl, setPrUrl] = useState(null)
  const [prNumber, setPrNumber] = useState(null)
  const [error, setError] = useState('')
  const titleRef = useRef(null)
  const prevIsOpenRef = useRef(false)

  // Reset state only when modal transitions from closed → open (not when defaults change)
  useEffect(() => {
    const wasOpen = prevIsOpenRef.current
    prevIsOpenRef.current = isOpen
    if (isOpen && !wasOpen) {
      setTitle(defaultTitle)
      setBody(defaultBody)
      setBase('main')
      setSubmitting(false)
      setPrUrl(null)
      setPrNumber(null)
      setError('')
      setTimeout(() => titleRef.current?.focus(), 50)
    }
  }, [isOpen, defaultTitle, defaultBody])

  // Close on Escape (but not while submitting)
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => { if (e.key === 'Escape' && !submitting) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose, submitting])

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!title.trim()) { setError('PR title is required'); return }
    setSubmitting(true)
    setError('')
    try {
      const result = await onSubmit({ title: title.trim(), body: body.trim(), base: base.trim() || 'main' })
      setPrUrl(result.url)
      setPrNumber(result.number)
    } catch (err) {
      setError(err.message || 'Failed to create PR')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose() }}
    >
      <div className="w-full max-w-lg mx-4 rounded-xl border-2 border-border bg-surface shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Create GitHub Pull Request</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-lg leading-none"
            title="Close"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {prUrl ? (
            /* Success state */
            <div className="space-y-3">
              <div className="rounded-lg border-2 border-success/30 bg-success/5 p-4 text-center space-y-2">
                <p className="text-sm font-semibold text-success">PR Created!</p>
                <a
                  href={prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-accent hover:underline break-all"
                >
                  {prUrl}
                </a>
                {prNumber && (
                  <p className="text-xs text-text-muted">PR #{prNumber}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-full py-2 rounded-lg text-xs font-semibold border border-border text-text-muted hover:text-text-primary transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            /* Form state */
            <>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  PR Title <span className="text-danger">*</span>
                </label>
                <input
                  ref={titleRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={submitting}
                  placeholder="What does this PR do?"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface-alt text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 disabled:opacity-50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  disabled={submitting}
                  placeholder="Describe the changes in this PR.."
                  rows={6}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface-alt text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 disabled:opacity-50 resize-y"
                  style={{ fontFamily: 'var(--font-mono)', minHeight: '120px' }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  Base Branch
                </label>
                <input
                  type="text"
                  value={base}
                  onChange={(e) => setBase(e.target.value)}
                  disabled={submitting}
                  placeholder="main"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface-alt text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 disabled:opacity-50"
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
                <p className="text-[10px] text-text-muted">Branch to merge into (usually main or master)</p>
              </div>

              {error && (
                <div className="rounded-lg border border-danger/40 bg-danger/5 px-3 py-2">
                  <p className="text-xs text-danger">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — only show when not yet submitted */}
        {!prUrl && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !title.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Creating...
                </span>
              ) : 'Create PR'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
