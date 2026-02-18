const RISK_CONFIG = {
  Critical: { bg: 'bg-danger/10', text: 'text-danger' },
  High: { bg: 'bg-warning/10', text: 'text-warning' },
  Medium: { bg: 'bg-info/10', text: 'text-info' },
  Low: { bg: 'bg-success/10', text: 'text-success' },
}

function RiskBadge({ risk }) {
  // Extract risk level from string like "High (schema + access control foundation)"
  const level = risk.split(/\s/)[0]
  const config = RISK_CONFIG[level] || RISK_CONFIG.Medium

  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}>
      {level}
    </span>
  )
}

export default RiskBadge
