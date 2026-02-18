import { useMemo, useState } from 'react'

const EMPTY_DRAFT = {
  title: '',
  outcome: '',
  risk: 'Medium',
  acceptance: '',
  files: '',
}

function TaskCreator({ onCreate, onEnhance }) {
  const [prompt, setPrompt] = useState('')
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canCreate = useMemo(() => draft.title.trim().length > 0 && !busy, [draft.title, busy])

  const updateDraft = (key, value) => {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  const handleEnhance = async () => {
    if (!prompt.trim()) {
      setError('Describe the task first.')
      return
    }

    setBusy(true)
    setError('')

    try {
      const suggestion = await onEnhance(prompt)
      setDraft({
        title: suggestion.title || '',
        outcome: suggestion.outcome || '',
        risk: suggestion.risk || 'Medium',
        acceptance: (suggestion.acceptance || []).join('\n'),
        files: (suggestion.files || []).join(', '),
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleCreate = async () => {
    setBusy(true)
    setError('')

    try {
      await onCreate({
        title: draft.title,
        outcome: draft.outcome,
        risk: draft.risk,
        status: 'pending',
        acceptance: draft.acceptance
          .split('\n')
          .map(item => item.trim())
          .filter(Boolean),
        files: draft.files
          .split(',')
          .map(item => item.trim())
          .filter(Boolean),
      })

      setPrompt('')
      setDraft(EMPTY_DRAFT)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface-alt p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-text-primary">Create Task</h3>
        <button
          onClick={handleEnhance}
          disabled={busy}
          className="px-3 py-1.5 rounded-md text-sm font-medium bg-accent/20 text-accent-hover hover:bg-accent/30 disabled:opacity-50"
        >
          Enhance with AI
        </button>
      </div>

      <textarea
        rows={2}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Describe the task in natural language..."
        className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary"
      />

      <input
        value={draft.title}
        onChange={(event) => updateDraft('title', event.target.value)}
        placeholder="Task title"
        className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input
          value={draft.outcome}
          onChange={(event) => updateDraft('outcome', event.target.value)}
          placeholder="Outcome"
          className="md:col-span-2 bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary"
        />

        <select
          value={draft.risk}
          onChange={(event) => updateDraft('risk', event.target.value)}
          className="bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary"
        >
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
          <option>Critical</option>
        </select>
      </div>

      <textarea
        rows={3}
        value={draft.acceptance}
        onChange={(event) => updateDraft('acceptance', event.target.value)}
        placeholder="Acceptance criteria (one per line)"
        className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary"
      />

      <input
        value={draft.files}
        onChange={(event) => updateDraft('files', event.target.value)}
        placeholder="Files (comma-separated)"
        className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary"
      />

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end">
        <button
          onClick={handleCreate}
          disabled={!canCreate}
          className="px-3 py-1.5 rounded-md text-sm font-medium bg-success/20 text-success hover:bg-success/30 disabled:opacity-50"
        >
          Create Task
        </button>
      </div>
    </div>
  )
}

export default TaskCreator
