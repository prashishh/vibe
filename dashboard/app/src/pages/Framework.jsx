import data from 'virtual:builds-data'
import MarkdownView from '../components/MarkdownView.jsx'

function Framework() {
  const { framework } = data

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          Vibe
        </h1>
        <p className="text-text-secondary">
          The development workflow framework used for this project.
          Sourced from <code className="text-accent-hover text-sm">docs/OUTCOME_CYCLES.md</code>.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface-alt p-8 max-h-[80vh] overflow-y-auto">
        {framework ? (
          <MarkdownView content={framework} />
        ) : (
          <div className="text-center py-16 text-text-muted">
            <p className="text-lg">Framework document not found.</p>
            <p className="text-sm mt-2">
              Create <code className="text-accent-hover">docs/OUTCOME_CYCLES.md</code> in the main project.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Framework
