import { useEffect, useRef, useState } from 'react'

const LAYERS = ['Contract', 'Browser', 'API', 'Database']
const RISKS = ['Low', 'Medium', 'High', 'Total']

/**
 * Parse existing guards content to find the highest guard ID number.
 * Looks for patterns like "## G-01:", "## G-12:", etc.
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

/**
 * Convert plain text form fields to a markdown guard block.
 */
function formatGuardMarkdown({ id, name, contract, invariants, layer, risk }) {
  const lines = [
    '',
    `## ${id}: ${name}`,
    `- **Contract**: ${contract}`,
    `- **Invariants**: ${invariants}`,
    `- **Layer**: ${layer}`,
    `- **Risk if broken**: ${risk}`,
  ]
  return lines.join('\n') + '\n'
}

function GuardModal({ onClose, onSave, initialContent = '', existingContent = '' }) {
  const isEditing = Boolean(initialContent)
  const modalRef = useRef(null)
  const firstInputRef = useRef(null)

  // Edit mode state — raw markdown textarea
  const [editContent, setEditContent] = useState(initialContent)

  // Create mode state — structured form
  const [name, setName] = useState('')
  const [contract, setContract] = useState('')
  const [invariants, setInvariants] = useState('')
  const [layer, setLayer] = useState('API')
  const [risk, setRisk] = useState('Medium')

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
    if (!name.trim()) {
      setError('Guard name is required.')
      return
    }
    if (!contract.trim()) {
      setError('Contract is required.')
      return
    }

    setBusy(true)
    setError('')

    try {
      const guardId = getNextGuardId(existingContent)
      const newBlock = formatGuardMarkdown({
        id: guardId,
        name: name.trim(),
        contract: contract.trim(),
        invariants: invariants.trim() || 'TBD',
        layer,
        risk,
      })

      // Append to existing content
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
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

        <p className="text-xs text-text-muted">
          {isEditing
            ? 'Edit your guard contracts below. Each guard defines a core invariant that must never break.'
            : 'Define a new guard in plain text. It will be formatted and appended to your existing guards.'}
        </p>

        {/* ── Edit Mode — raw markdown textarea ── */}
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

        {/* ── Create Mode — structured plain text form ── */}
        {!isEditing && (
          <div className="flex-1 overflow-y-auto space-y-3">
            {/* Guard Name */}
            <label className="block space-y-1">
              <span className="text-xs font-medium text-text-secondary">Guard Name</span>
              <input
                ref={firstInputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Auth Token Validation"
                className="w-full bg-surface-alt border-2 border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
              />
            </label>

            {/* Contract */}
            <label className="block space-y-1">
              <span className="text-xs font-medium text-text-secondary">Contract</span>
              <span className="text-[10px] text-text-muted ml-1">— What must always hold true</span>
              <textarea
                value={contract}
                onChange={(e) => setContract(e.target.value)}
                placeholder="e.g. Every API request must include a valid authentication token"
                rows={2}
                className="w-full bg-surface-alt border-2 border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none resize-y"
              />
            </label>

            {/* Invariants */}
            <label className="block space-y-1">
              <span className="text-xs font-medium text-text-secondary">Invariants</span>
              <span className="text-[10px] text-text-muted ml-1">— Specific conditions that must not be violated</span>
              <textarea
                value={invariants}
                onChange={(e) => setInvariants(e.target.value)}
                placeholder="e.g. Token expiry checked before processing, signature verified against secret"
                rows={2}
                className="w-full bg-surface-alt border-2 border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none resize-y"
              />
            </label>

            {/* Layer + Risk — side by side */}
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-text-secondary">Layer</span>
                <select
                  value={layer}
                  onChange={(e) => setLayer(e.target.value)}
                  className="w-full bg-surface-alt border-2 border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                >
                  {LAYERS.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-text-secondary">Risk if Broken</span>
                <select
                  value={risk}
                  onChange={(e) => setRisk(e.target.value)}
                  className="w-full bg-surface-alt border-2 border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                >
                  {RISKS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Preview */}
            {name.trim() && (
              <div className="rounded-lg border border-border bg-surface-alt/50 px-3 py-2">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Preview</p>
                <div className="text-xs text-text-secondary space-y-0.5" style={{ fontFamily: "var(--font-mono)" }}>
                  <p className="font-semibold text-text-primary">## {getNextGuardId(existingContent)}: {name.trim()}</p>
                  <p>- <strong>Contract</strong>: {contract.trim() || '...'}</p>
                  <p>- <strong>Invariants</strong>: {invariants.trim() || 'TBD'}</p>
                  <p>- <strong>Layer</strong>: {layer}</p>
                  <p>- <strong>Risk if broken</strong>: {risk}</p>
                </div>
              </div>
            )}
          </div>
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
