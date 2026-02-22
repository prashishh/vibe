import { useEffect, useRef, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''

/**
 * Parse existing guards content to find the highest guard ID number.
 */
function getNextGuardId(existingContent) {
  if (!existingContent) return 'G-01'
  const pattern = /##\s*G-(\d+):/g
  let maxNum = 0
  let match
  while ((match = pattern.exec(existingContent)) !== null) {
    const num = parseInt(match[1], 10)
    if (num > maxNum) maxNum = num
  }
  const next = maxNum + 1
  return `G-${String(next).padStart(2, '0')}`
}

function GuardModal({ onClose, onSave, initialContent = '', existingContent = '' }) {
  const isEditing = Boolean(initialContent)
  const modalRef = useRef(null)
  const firstInputRef = useRef(null)

  // Edit mode state
  const [editContent, setEditContent] = useState(initialContent)

  // Create mode state — single text field
  const [description, setDescription] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    firstInputRef.current?.focus()

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSaveEdit = async () => {
    if (!editContent.trim()) {
      setError('Guard content cannot be empty.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onSave(editContent)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleSaveCreate = async () => {
    const text = description.trim()
    if (!text) {
      setError('Please describe the guard you want to add.')
      return
    }

    setBusy(true)
    setError('')

    try {
      // Try the LLM-powered endpoint first
      const res = await fetch(`${API_BASE}/api/guards/from-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: text }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.content) {
          await onSave(data.content)
          onClose()
          return
        }
      }

      // Fallback: format the description as a simple guard block
      const guardId = getNextGuardId(existingContent)
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      const name = lines[0].length > 80 ? lines[0].slice(0, 80) : lines[0]
      const contract = lines.length > 1 ? lines.slice(1).join(' ') : lines[0]

      const newBlock = [
        '',
        `## ${guardId}: ${name}`,
        `- **Contract**: ${contract}`,
        `- **Invariants**: TBD`,
        `- **Layer**: API`,
        `- **Risk if broken**: Medium`,
        '',
      ].join('\n')

      let fullContent = existingContent || ''
      if (!fullContent.trim()) {
        fullContent = '# Guards\n'
      }
      fullContent = fullContent.trimEnd() + '\n' + newBlock

      await onSave(fullContent)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleKeyDownSave = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      if (isEditing) handleSaveEdit()
      else handleSaveCreate()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guard-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={modalRef}
        className="relative bg-surface rounded-xl border-2 border-border card-shadow w-full max-w-2xl mx-4 p-6 space-y-4 max-h-[85vh] flex flex-col"
        onKeyDown={handleKeyDownSave}
      >
        <div className="flex items-center justify-between">
          <h3 id="guard-modal-title" className="text-base font-bold text-text-primary">
            {isEditing ? 'Edit Guards' : 'Add Guard'}
          </h3>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-lg leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <p className="text-xs text-text-secondary">
          {isEditing
            ? 'Edit the raw markdown below.'
            : 'Just say what should never happen, and we\'ll turn it into a guard.'}
        </p>

        {isEditing && (
          <textarea
            ref={firstInputRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="flex-1 min-h-64 bg-surface-alt border-2 border-border rounded-lg px-3 py-2.5 text-sm text-text-primary leading-relaxed resize-y focus:border-accent focus:outline-none"
            style={{ fontFamily: "var(--font-mono)" }}
            spellCheck={false}
          />
        )}

        {!isEditing && (
          <textarea
            ref={firstInputRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={"e.g. Never drop a database table, always use migrations instead"}
            rows={5}
            className="flex-1 min-h-32 bg-surface-alt border-2 border-border rounded-lg px-3 py-2.5 text-sm text-text-primary leading-relaxed resize-y focus:border-accent focus:outline-none placeholder:text-text-muted"
          />
        )}

        {error && (
          <p className="text-sm text-danger" role="alert">{error}</p>
        )}

        <div className="flex items-center gap-2 justify-end pt-1">
          <span className="text-[10px] text-text-muted mr-auto">
            {navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}+S to save
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-text-muted hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={isEditing ? handleSaveEdit : handleSaveCreate}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {busy ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Guard'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default GuardModal
