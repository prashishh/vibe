export default function Commands() {
  const commands = [
    {
      name: '/vibe',
      syntax: '/vibe <description>',
      description: 'Quick fix (1-3 tasks) - runs entire workflow automatically',
      time: '2-5 minutes',
      example: '/vibe Fix button alignment on mobile'
    },
    {
      name: '/lite',
      syntax: '/lite <feature>',
      description: 'Lite Build (3-8 tasks) - autonomous with one approval',
      time: '1-4 hours',
      example: '/lite Add CSV export to admin dashboard'
    },
    {
      name: '/full',
      syntax: '/full <feature>',
      description: 'Full Build (8+ tasks) - autonomous with multiple checkpoints',
      time: '4+ hours',
      example: '/full Implement SSO authentication'
    },
    {
      name: '/start',
      description: 'Initialize framework in project (one-time setup)',
      example: '/start'
    },
    {
      name: '/guards',
      description: 'Analyze codebase and generate safety guards',
      example: '/guards'
    },
    {
      name: '/plan',
      description: 'Create build planning documents',
      example: '/plan Add user notifications'
    },
    {
      name: '/execute',
      description: 'Work on next pending task',
      example: '/execute'
    },
    {
      name: '/check',
      description: 'Run all guard tests',
      example: '/check'
    },
    {
      name: '/review',
      description: 'Create review document (Full builds)',
      example: '/review'
    },
    {
      name: '/ship',
      description: 'Create deployment checklist',
      example: '/ship'
    },
    {
      name: '/recap',
      description: 'Close build with summary',
      example: '/recap'
    },
    {
      name: '/propose',
      description: 'Suggest next build from RECAP seeds',
      example: '/propose'
    }
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Commands</h1>
        <p className="text-muted">Available Vibe Framework commands</p>
      </div>

      <div className="space-y-4">
        {commands.map((cmd) => (
          <div key={cmd.name} className="bg-card border border-border rounded-lg p-6 hover:border-accent/50 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-xl font-bold text-foreground mb-1">
                  <code className="bg-accent/20 px-2 py-1 rounded">{cmd.name}</code>
                </h3>
                <p className="text-muted">{cmd.description}</p>
              </div>
              {cmd.time && (
                <div className="text-sm text-accent font-medium ml-4">
                  {cmd.time}
                </div>
              )}
            </div>

            {cmd.syntax && (
              <div className="mb-3">
                <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Syntax</div>
                <code className="bg-accent/10 px-3 py-2 rounded block text-sm">{cmd.syntax}</code>
              </div>
            )}

            <div>
              <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Example</div>
              <code className="bg-accent/10 px-3 py-2 rounded block text-sm text-accent">{cmd.example}</code>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
