import { useEffect, useRef, useState } from 'react'

function AddCardModal({ onClose, onCreate }) {
  const [description, setDescription] = useState('')
  const [buildType, setBuildType] = useState('vibe')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const modalRef = useRef(null)
  const textareaRef = useRef(null)

  // Focus textarea on mount, handle Escape, and trap focus within modal
  useEffect(() => {
    textareaRef.current?.focus()

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose(null)
        return
      }

      // Focus trap
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

  const handleCreate = async () => {
    if (!description.trim()) {
      setError('Describe what you want to build.')
      return
    }

    setBusy(true)
    setError('')

    try {
      const build = await onCreate({ description, buildType })
      onClose(build)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-card-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={() => onClose(null)}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-surface rounded-xl border-2 border-border card-shadow w-full max-w-lg mx-4 p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 id="add-card-title" className="text-base font-bold text-text-primary">New Cycle</h3>
          <button
            onClick={() => onClose(null)}
            className="text-text-muted hover:text-text-primary text-lg leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <p className="text-xs text-text-muted">
          Each cycle is a scoped unit of work — Vibe, Lite, or Full. Describe the goal and choose a type.
        </p>

        <textarea
          ref={textareaRef}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the goal of this cycle..."
          className="w-full bg-surface-alt border-2 border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              handleCreate()
            }
          }}
        />

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-text-secondary">Cycle Type</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'vibe', label: 'Vibe', desc: 'Quick fix or polish. AI runs autonomously, no approvals.' },
              { value: 'lite', label: 'Lite', desc: 'Straightforward feature. One human checkpoint before shipping.' },
              { value: 'full', label: 'Full', desc: 'Complex work. Full doc set, multiple review gates.' },
            ].map(({ value, label, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => setBuildType(value)}
                className={`text-left rounded-lg border-2 px-3 py-2.5 transition-colors ${
                  buildType === value
                    ? 'border-accent bg-accent/5 text-text-primary'
                    : 'border-border bg-surface-alt text-text-muted hover:border-border-light hover:text-text-primary'
                }`}
              >
                <span className="block text-sm font-bold mb-0.5">{label}</span>
                <span className="block text-[10px] leading-snug">{desc}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-danger" role="alert">{error}</p>
        )}

        <div className="flex items-center gap-2 justify-end pt-2">
          <span className="text-[10px] text-text-muted mr-auto">
            {navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to create
          </span>
          <button
            onClick={() => onClose(null)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-text-muted hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {busy ? 'Creating...' : 'Create Cycle'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddCardModal
