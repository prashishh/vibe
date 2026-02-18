function BuildSelector({ builds, value, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
      <span className="font-medium">Build</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-surface border-2 border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
      >
        {builds.map((build) => (
          <option key={build.buildId} value={build.buildId}>
            {build.buildId} ({build.doneTasks}/{build.totalTasks})
          </option>
        ))}
      </select>
    </label>
  )
}

export default BuildSelector
