// ─────────────────────────────────────────────────────────────────────────────
// Diff line parser — no npm packages, pure JS
// ─────────────────────────────────────────────────────────────────────────────

function parseDiffLines(diffText) {
  return (diffText || '').split('\n').map(line => {
    if (line.startsWith('+++') || line.startsWith('---')) return { type: 'header', text: line }
    if (line.startsWith('@@')) return { type: 'hunk', text: line }
    if (line.startsWith('+')) return { type: 'addition', text: line }
    if (line.startsWith('-')) return { type: 'deletion', text: line }
    return { type: 'context', text: line }
  })
}

const LINE_CLASSES = {
  header:   'text-[#8a7b6f] italic',
  hunk:     'text-blue-300 bg-blue-900/20',
  addition: 'text-green-300 bg-green-900/10',
  deletion: 'text-red-300 bg-red-900/10',
  context:  'text-[#f0e6d9]',
}

// ─────────────────────────────────────────────────────────────────────────────
// DiffContent — renders parsed diff lines
// ─────────────────────────────────────────────────────────────────────────────

function DiffContent({ diff, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-[#8a7b6f] text-xs">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#8a7b6f] border-t-transparent mr-2" />
        Loading diff...
      </div>
    )
  }

  if (diff === null) {
    return (
      <div className="flex items-center justify-center h-32 text-[#8a7b6f] text-xs italic">
        Select a file to view its diff
      </div>
    )
  }

  if (!diff) {
    return (
      <div className="flex items-center justify-center h-32 text-[#8a7b6f] text-xs italic">
        No changes in this file
      </div>
    )
  }

  const lines = parseDiffLines(diff)

  return (
    <div
      className="overflow-auto text-xs font-mono"
      style={{ fontFamily: 'var(--font-mono)' }}
    >
      {lines.map((line, i) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className={`whitespace-pre px-3 py-px leading-5 ${LINE_CLASSES[line.type] || LINE_CLASSES.context}`}
        >
          {line.text || '\u00a0'}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FileList — left panel with clickable file entries
// ─────────────────────────────────────────────────────────────────────────────

function FileList({ files, selectedFile, onSelectFile, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-24 text-[#8a7b6f] text-xs">
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#8a7b6f] border-t-transparent mr-2" />
        Loading...
      </div>
    )
  }

  if (!files.length) {
    return (
      <div className="p-3 text-[#8a7b6f] text-xs italic">
        No changes detected
      </div>
    )
  }

  return (
    <ul className="overflow-y-auto flex-1">
      {files.map((file, i) => {
        const isSelected = selectedFile && selectedFile.path === file.path && selectedFile.taskId === file.taskId
        const shortName = file.path.split('/').pop()
        const dir = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : ''
        return (
          <li key={`${file.taskId}-${file.path}-${i}`}>
            <button
              type="button"
              onClick={() => onSelectFile(file)}
              className={[
                'w-full text-left px-3 py-2 border-b border-[#3a2e24] transition-colors',
                isSelected
                  ? 'bg-[#3a2e24] text-[#f0e6d9]'
                  : 'text-[#b8a99a] hover:bg-[#2a1f15] hover:text-[#f0e6d9]',
              ].join(' ')}
            >
              <div className="text-xs font-medium truncate">{shortName}</div>
              {dir && (
                <div className="text-[10px] text-[#8a7b6f] truncate">{dir}</div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] ${(file.additions || 0) > 0 ? 'text-green-400' : 'text-[#8a7b6f]'}`}>
                  +{file.additions ?? 0}
                </span>
                <span className={`text-[10px] ${(file.deletions || 0) > 0 ? 'text-red-400' : 'text-[#8a7b6f]'}`}>
                  -{file.deletions ?? 0}
                </span>
                <span className="text-[10px] text-[#8a7b6f] ml-auto">{file.taskId}</span>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DiffViewer — main export
// Props:
//   buildId       string
//   files         [{path, additions, deletions, taskId, branchName}]
//   onSelectFile  (file) => void   — parent loads the diff for this file
//   selectedFile  file | null
//   diff          string | null    — null = not loaded yet
//   loading       boolean
// ─────────────────────────────────────────────────────────────────────────────

export default function DiffViewer({ files = [], onSelectFile, selectedFile, diff, loading }) {
  const totalAdditions = files.reduce((s, f) => s + (f.additions || 0), 0)
  const totalDeletions = files.reduce((s, f) => s + (f.deletions || 0), 0)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#3a2e24] text-xs text-[#8a7b6f] shrink-0">
        <span className="font-medium text-[#b8a99a]">Changed Files</span>
        {files.length > 0 && (
          <>
            <span className="text-[#8a7b6f]">{files.length} file{files.length !== 1 ? 's' : ''}</span>
            {totalAdditions > 0 && <span className="text-green-400">+{totalAdditions}</span>}
            {totalDeletions > 0 && <span className="text-red-400">-{totalDeletions}</span>}
          </>
        )}
      </div>

      {/* Body: file list + diff pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: file list */}
        <div className="w-52 shrink-0 border-r border-[#3a2e24] bg-[#1a1008] flex flex-col overflow-hidden">
          <FileList
            files={files}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            loading={loading}
          />
        </div>

        {/* Right: diff content */}
        <div className="flex-1 bg-[#1e1510] overflow-auto">
          {selectedFile && (
            <div className="px-3 py-1 border-b border-[#3a2e24] text-[10px] text-[#8a7b6f] font-mono truncate">
              {selectedFile.path}
            </div>
          )}
          <DiffContent diff={diff} loading={selectedFile !== null && diff === null} />
        </div>
      </div>
    </div>
  )
}
