import { useState } from 'react'

function BuildCreator({ onAssist, onCreate, onCreated, onCancel }) {
  const [buildType, setBuildType] = useState('lite')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [questions, setQuestions] = useState([])

  const handleAssist = async () => {
    if (!description.trim()) {
      setError('Describe what you want to build.')
      return
    }

    setBusy(true)
    setError('')

    try {
      const suggestion = await onAssist({
        description,
        buildType,
      })
      setQuestions(suggestion.questions || [])

      if (suggestion.buildType) {
        setBuildType(suggestion.buildType)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleCreate = async () => {
    if (!description.trim()) {
      setError('Cycle description is required.')
      return
    }

    setBusy(true)
    setError('')

    try {
      const created = await onCreate({
        description,
        buildType,
      })
      setQuestions([])
      onCreated?.(created)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border-2 border-border bg-surface-alt p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-text-primary">New Cycle</h3>
        <button
          onClick={onCancel}
          className="text-sm text-text-muted hover:text-text-primary"
        >
          Cancel
        </button>
      </div>

      <label className="text-xs font-medium text-text-secondary space-y-1 block max-w-xs">
        Cycle Type
        <select
          value={buildType}
          onChange={(event) => setBuildType(event.target.value)}
          className="w-full bg-surface border-2 border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
        >
          <option value="lite">Vibe (Quick)</option>
          <option value="full">Full (Structured)</option>
        </select>
      </label>

      <textarea
        rows={3}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Describe what you want to build.."
        className="w-full bg-surface border-2 border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
      />

      {questions.length > 0 && (
        <div className="rounded-lg border-2 border-warning/30 bg-warning/5 p-3">
          <p className="text-xs font-semibold text-warning mb-1">Questions to Consider</p>
          <ul className="text-xs text-text-secondary list-disc pl-4 space-y-1">
            {questions.map((question, idx) => (
              <li key={`${question}-${idx}`}>{question}</li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={handleAssist}
          disabled={busy}
          className="px-4 py-2 rounded-lg text-sm font-medium border-2 border-info text-info hover:bg-info/10 disabled:opacity-50"
        >
          Get Suggestions
        </button>
        <button
          onClick={handleCreate}
          disabled={busy}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
        >
          Create Cycle
        </button>
      </div>
    </section>
  )
}

export default BuildCreator
