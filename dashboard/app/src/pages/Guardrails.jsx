import { useCallback, useEffect, useState } from 'react'
import data from 'virtual:builds-data'
import MarkdownView from '../components/MarkdownView.jsx'
import GuardModal from '../components/GuardModal.jsx'

const API_BASE = import.meta.env.VITE_API_URL || ''

function Guards() {
  const { guardrails: staticGuardrails, builds } = data
  const [guardrails, setGuardrails] = useState(staticGuardrails || '')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState('create') // 'create' | 'edit'

  // Load guardrails from runtime API (more up-to-date than build-time virtual module)
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/guards`)
        if (res.ok) {
          const data = await res.json()
          if (data.content) {
            setGuardrails(data.content)
          }
        }
      } catch {
        // Fall back to static virtual module data (already set)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = useCallback(async (content) => {
    const res = await fetch(`${API_BASE}/api/guards`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to save guards')
    }
    setGuardrails(content)
  }, [])

  const handleAddClick = () => {
    setModalMode('create')
    setShowModal(true)
  }

  const handleEditClick = () => {
    setModalMode('edit')
    setShowModal(true)
  }

  // Collect all guard references across builds
  const guardrailRefs = {}
  for (const build of builds) {
    for (const g of build.goal.guardrailImpact || []) {
      if (!guardrailRefs[g.id]) {
        guardrailRefs[g.id] = []
      }
      guardrailRefs[g.id].push({
        version: build.version,
        title: build.title,
        impact: g.impact,
      })
    }
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">
            Guards
          </h1>
          <p className="text-text-secondary">
            Core contracts that must never break. Verified after every build.
            Sourced from <code className="text-accent-hover text-sm">GUARDRAILS.md</code>.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleAddClick}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-accent text-white hover:bg-accent-hover transition-colors"
          >
            + Add Guard
          </button>
          {guardrails && (
            <button
              onClick={handleEditClick}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold border-2 border-accent text-accent hover:bg-accent hover:text-white transition-colors"
            >
              Edit All
            </button>
          )}
        </div>
      </div>

      {/* Guard Cross-Reference from Builds */}
      {Object.keys(guardrailRefs).length > 0 && (
        <div className="rounded-xl border border-border bg-surface-alt p-6 mb-8">
          <h3 className="text-base font-semibold text-text-primary mb-4">
            Guard Impact Across Builds
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Guard
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Referenced By
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Impact
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(guardrailRefs).sort((a, b) => a[0].localeCompare(b[0])).map(([id, refs]) => (
                  refs.map((ref, i) => (
                    <tr key={`${id}-${i}`} className="border-b border-border/50">
                      {i === 0 && (
                        <td className="px-4 py-2 text-sm font-mono text-accent-hover font-medium" rowSpan={refs.length}>
                          {id}
                        </td>
                      )}
                      <td className="px-4 py-2 text-sm text-text-primary">
                        <span className="font-mono text-text-muted text-xs mr-2">{ref.version}</span>
                        {ref.title}
                      </td>
                      <td className="px-4 py-2 text-sm text-text-secondary">
                        {ref.impact}
                      </td>
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Guards Document */}
      <div className="rounded-xl border border-border bg-surface-alt p-8 max-h-[70vh] overflow-y-auto">
        {loading ? (
          <div className="text-center py-16 text-text-muted">
            <p className="text-sm">Loading guards...</p>
          </div>
        ) : guardrails ? (
          <MarkdownView content={guardrails} />
        ) : (
          <div className="text-center py-16 text-text-muted">
            <p className="text-lg">No guards defined yet.</p>
            <p className="text-sm mt-2">
              Guards are core contracts that must never break. Define them to protect your project's invariants.
            </p>
            <button
              onClick={handleAddClick}
              className="mt-6 px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-white hover:bg-accent-hover transition-colors"
            >
              + Create Your First Guard
            </button>
          </div>
        )}
      </div>

      {/* Guard Modal */}
      {showModal && (
        <GuardModal
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          initialContent={modalMode === 'edit' ? guardrails : ''}
          existingContent={guardrails}
        />
      )}
    </div>
  )
}

export default Guards
