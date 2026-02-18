import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TaskColumn from './TaskColumn.jsx'
import AddCardModal from './AddCardModal.jsx'
import ExecutionView from './ExecutionView.jsx'
import { useTaskAPI } from '../hooks/useTaskAPI.js'
import { useSSE } from '../hooks/useSSE.js'
import { useTerminalOutput } from '../hooks/useTerminalOutput.js'

const COLUMNS = [
  { title: 'Idea', status: 'pending', color: 'var(--color-column-backlog)', tooltip: 'A cycle that has been captured but not yet scoped. Drop it into Planning to let AI generate the goal and tasks.' },
  { title: 'Planning', status: 'planning', color: 'var(--color-column-planning)', tooltip: 'AI is actively scoping this cycle — generating GOAL, PLAN, and TASKS docs. Hands off until it moves to Building.' },
  { title: 'Building', status: 'in_progress', color: 'var(--color-column-progress)', tooltip: 'Tasks are being executed, either by AI or manually. The cycle is actively in flight.' },
  { title: 'Review', status: 'review', color: 'var(--color-column-review)', tooltip: 'Execution is done. A human reviews the output, checks guards, and decides whether to ship or send back.' },
  { title: 'Shipped', status: 'deployed', color: 'var(--color-column-deployed)', tooltip: 'The cycle has been deployed and recapped. RECAP.md is written and the cycle is closed.' },
  { title: 'Stalled', status: 'blocked', color: 'var(--color-column-blocked)', tooltip: 'Needs human input before it can continue — re-scoping, a decision, or an external dependency.' },
]

const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)'

function useIsDesktopViewport() {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }
    return window.matchMedia(DESKTOP_MEDIA_QUERY).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }

    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY)
    const handleChange = (event) => setIsDesktop(event.matches)
    setIsDesktop(mediaQuery.matches)

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  return isDesktop
}

/**
 * Drain the concurrency queue: start tasks until we hit the max-concurrent cap.
 * Called whenever a task finishes or when the queue is first populated.
 */
function drainQueue(queueRef) {
  const q = queueRef.current
  if (!q) return
  while (q.running.size < q.maxConcurrent && q.pending.length > 0) {
    const task = q.pending.shift()
    q.running.add(task.id)
    q.addLogFn('system', `Starting ${task.id}: ${task.title}...`)
    q.startFn(task.id).catch(err => {
      q.addLogFn('error', `Failed to start ${task.id}: ${err.message}`)
      q.running.delete(task.id)
      drainQueue(queueRef)
    })
  }
}

function TaskBoard() {
  const isDesktopViewport = useIsDesktopViewport()
  const [selectedBuildId, setSelectedBuildId] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [hasLogs, setHasLogs] = useState(false)
  const terminal = useTerminalOutput()
  const [planningBuilds, setPlanningBuilds] = useState(new Set())
  const [buildDocs, setBuildDocs] = useState({})
  const [pendingQuestions, setPendingQuestions] = useState([])
  const concurrencyQueueRef = useRef(null)

  const {
    builds,
    tasks,
    loading,
    error,
    setTasks,
    createBuild,
    planBuild,
    updateBuildStatus,
    removeBuild,
    reload,
    refreshBuilds,
    refreshTasks,
    fetchDocs,
    saveDoc,
    sendChat,
    patchTask,
    startExecution,
    cancelExecution,
  } = useTaskAPI(selectedBuildId)

  // SSE handlers
  const onTasksUpdated = useCallback((payload) => {
    if (!payload?.tasks) return
    setTasks(payload.tasks)
  }, [setTasks])

  const onTaskStatusChanged = useCallback((payload) => {
    if (!payload?.taskId || !payload?.status) return
    setTasks(prev => prev.map(task => (
      task.id === payload.taskId
        ? { ...task, status: payload.status, blockedReason: payload.blockedReason || task.blockedReason }
        : task
    )))

    // Concurrency queue: when a task reaches a terminal status, free its slot + drain
    const terminalStatuses = new Set(['review', 'blocked', 'deployed'])
    const q = concurrencyQueueRef.current
    if (
      q &&
      terminalStatuses.has(payload.status) &&
      q.buildId === payload.buildId &&
      q.running.has(payload.taskId)
    ) {
      q.running.delete(payload.taskId)
      drainQueue(concurrencyQueueRef)
    }
  }, [setTasks])

  // SSE execution-log handler — appends directly to DOM for terminal-speed rendering
  const onExecutionLog = useCallback((payload) => {
    if (!payload?.message && payload?.message !== '') return
    terminal.appendLine({
      stream: payload.stream || 'log',
      message: payload.message,
      timestamp: payload.timestamp || new Date().toISOString(),
    })
    setHasLogs(true)
  }, [terminal])

  // SSE build-status-changed handler — refreshes builds when engine auto-moves a build
  const onBuildStatusChanged = useCallback((payload) => {
    refreshBuilds()
    if (payload?.buildId) {
      setPlanningBuilds(prev => {
        if (!prev.has(payload.buildId)) return prev
        const next = new Set(prev)
        next.delete(payload.buildId)
        return next
      })
      if (payload.status === 'planning' || payload.status === 'blocked') {
        refreshTasks(payload.buildId)
        fetchDocs(payload.buildId).then(docs => setBuildDocs(docs)).catch(() => {})
      }
    }
  }, [refreshBuilds, refreshTasks, fetchDocs])

  // SSE runner-questions handler — surfaces runner's clarifying questions in the UI
  const onRunnerQuestions = useCallback((payload) => {
    if (!payload?.questions?.length) return
    const cleanedQuestions = payload.questions
      .map(q => String(q || '').replace(/\s+/g, ' ').trim())
      .filter(q => q && q !== '?')
    if (cleanedQuestions.length === 0) return
    setPendingQuestions(prev => [
      ...prev,
      {
        phase: payload.phase || 'unknown',
        taskId: payload.taskId || null,
        questions: cleanedQuestions,
        timestamp: payload.timestamp || new Date().toISOString(),
      },
    ])
  }, [])

  useSSE(selectedBuildId, {
    onTasksUpdated,
    onTaskStatusChanged,
    onExecutionLog,
    onBuildStatusChanged,
    onRunnerQuestions,
  })

  // Load persisted logs when switching builds (survives page refresh)
  useEffect(() => {
    if (!selectedBuildId) {
      terminal.clear()
      setHasLogs(false)
      return
    }
    // Fetch persisted logs from server
    fetch(`/api/tasks/builds/${selectedBuildId}/logs`)
      .then(res => res.ok ? res.json() : { logs: [] })
      .then(data => {
        const persisted = (data.logs || []).map(entry => ({
          stream: entry.stream || 'log',
          message: entry.message || '',
          timestamp: entry.ts || new Date().toISOString(),
        }))
        terminal.clear()
        terminal.appendBatch(persisted)
        setHasLogs(persisted.length > 0)
      })
      .catch(() => { terminal.clear(); setHasLogs(false) })
  }, [selectedBuildId, terminal])

  // Load docs when a build is selected (if it has docs)
  useEffect(() => {
    if (!selectedBuildId) {
      setBuildDocs({})
      return
    }
    const build = builds.find(b => b.buildId === selectedBuildId)
    if (build && build.status !== 'pending') {
      fetchDocs(selectedBuildId).then(docs => setBuildDocs(docs)).catch(() => setBuildDocs({}))
    } else {
      setBuildDocs({})
    }
  }, [selectedBuildId, builds, fetchDocs])

  // Group builds by status for columns, sorted by version number (v1 first)
  const buildsByStatus = useMemo(() => {
    const grouped = {
      pending: [],
      planning: [],
      in_progress: [],
      review: [],
      deployed: [],
      blocked: [],
    }

    for (const build of builds) {
      const status = grouped[build.status] ? build.status : 'pending'
      grouped[status].push(build)
    }

    // Sort each column by version number ascending (v1, v2, v3, ...)
    const versionNum = (buildId = '') => {
      const match = String(buildId).match(/(\d+)/)
      return match ? parseInt(match[1], 10) : Infinity
    }
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => versionNum(a.buildId) - versionNum(b.buildId))
    }

    return grouped
  }, [builds])

  const addLog = (stream, message) => {
    terminal.appendLine({
      stream,
      message,
      timestamp: new Date().toISOString(),
    })
    setHasLogs(true)
  }

  const handleAddCardClose = (build) => {
    setShowAddModal(false)
    if (build?.buildId) {
      refreshBuilds()
    }
  }

  const handleDrop = async (buildId, newStatus, currentStatus) => {
    // Select the build being moved and show sidebar
    setSelectedBuildId(buildId)
    setShowSidebar(true)

    if (currentStatus === 'pending' && newStatus === 'planning') {
      // Moving from Backlog to Planning — triggers real planning via CLI runner
      // All output is streamed via SSE (execution-log events) into Live Output

      // Guard against double-click — if already planning, skip
      if (planningBuilds.has(buildId)) {
        addLog('system', `${buildId} is already being planned...`)
        return
      }

      setPlanningBuilds(prev => new Set(prev).add(buildId))
      terminal.showPlaceholder('Waiting for output from runner...')

      try {
        // The server returns 202 immediately and runs planning in the background.
        // Progress streams via SSE; completion triggers build-status-changed which
        // calls refreshBuilds() via onBuildStatusChanged.
        await planBuild(buildId)
      } catch (err) {
        addLog('error', `Planning failed: ${err.message}`)
        setPlanningBuilds(prev => {
          const next = new Set(prev)
          next.delete(buildId)
          return next
        })
      }
    } else if (newStatus === 'planning' && currentStatus !== 'pending') {
      // Restoring to Planning (e.g. from Stalled) — docs already exist, just update status
      addLog('system', `Restoring ${buildId} to Planning...`)
      try {
        await updateBuildStatus(buildId, 'planning')
        addLog('success', `${buildId} restored to Planning.`)

        await refreshBuilds()
        await refreshTasks(buildId)
        const docs = await fetchDocs(buildId)
        setBuildDocs(docs)

        addLog('system', 'Existing plan docs preserved — ready to start building.')
      } catch (err) {
        addLog('error', `Failed: ${err.message}`)
      }
    } else if (newStatus === 'in_progress') {
      // Moving to Building — update status then auto-execute all pending tasks
      // If already in_progress, this is a retry — skip the status update
      const isRetry = currentStatus === 'in_progress'
      if (isRetry) {
        addLog('system', `Retrying task execution for ${buildId}...`)
      } else {
        addLog('system', `Moving ${buildId} to ${newStatus}...`)
      }
      try {
        if (!isRetry) {
          await updateBuildStatus(buildId, newStatus)
          addLog('success', `${buildId} moved to ${newStatus}.`)
        }

        // Refresh tasks to get the latest list, then auto-start all pending tasks
        await refreshTasks(buildId)
        await refreshBuilds()

        // Re-read tasks from API directly to avoid stale state
        const res = await fetch(`/api/tasks/${buildId}`)
        const data = await res.json()
        const taskList = data.tasks || []

        // Determine which tasks still need execution
        const doneStatuses = new Set(['review', 'deployed', 'blocked'])
        const pendingTasks = taskList.filter(t => t.status === 'pending')
        const runningTasks = taskList.filter(t => t.status === 'in_progress')
        const doneTasks = taskList.filter(t => doneStatuses.has(t.status))

        // If all tasks are already done, auto-move build to Review
        if (taskList.length > 0 && doneTasks.length === taskList.length) {
          addLog('success', 'All tasks already complete.')
          addLog('system', 'Moving cycle to Review...')
          try {
            await updateBuildStatus(buildId, 'review')
            addLog('success', `${buildId} moved to Review.`)
            await refreshBuilds()
          } catch (err) {
            addLog('error', `Failed to move to Review: ${err.message}`)
          }
          return
        }

        // If some tasks are running, just log it
        if (runningTasks.length > 0) {
          addLog('system', `${runningTasks.length} task(s) already running.`)
        }

        if (pendingTasks.length === 0) {
          if (runningTasks.length > 0) {
            addLog('system', 'Waiting for running tasks to complete...')
          } else {
            addLog('system', 'No pending tasks to execute.')
          }
          return
        }

        addLog('system', `Auto-starting ${pendingTasks.length} task(s) (max 2 at a time)...`)

        // Concurrency-capped queue — max 2 tasks in flight at a time
        // proper-lockfile in tasks-store.js serializes TASKS.md writes;
        // with worktrees each task also writes to its own isolated dir.
        concurrencyQueueRef.current = {
          pending: [...pendingTasks],
          running: new Set(),
          maxConcurrent: 2,
          buildId,
          startFn: startExecution,
          addLogFn: addLog,
        }
        drainQueue(concurrencyQueueRef)
      } catch (err) {
        addLog('error', `Failed: ${err.message}`)
      }
    } else if (newStatus === 'review') {
      // Moving to Review — run task summary check
      addLog('system', `Starting review for ${buildId}...`)
      try {
        // Fetch current task status
        const res = await fetch(`/api/tasks/${buildId}`)
        const data = await res.json()
        const taskList = data.tasks || []

        if (taskList.length > 0) {
          const doneStatuses = new Set(['review', 'deployed', 'blocked'])
          const done = taskList.filter(t => doneStatuses.has(t.status))
          const running = taskList.filter(t => t.status === 'in_progress')
          const pending = taskList.filter(t => t.status === 'pending')
          const blocked = taskList.filter(t => t.status === 'blocked')

          addLog('system', `Task summary: ${done.length} done, ${running.length} running, ${pending.length} pending, ${blocked.length} blocked`)

          if (running.length > 0) {
            addLog('warning', `${running.length} task(s) still running — they will continue in background.`)
          }
          if (blocked.length > 0) {
            addLog('warning', `${blocked.length} task(s) are blocked:`)
            blocked.forEach(t => addLog('warning', `  • ${t.id}: ${t.title}${t.blockedReason ? ` — ${t.blockedReason}` : ''}`))
          }
          if (pending.length > 0) {
            addLog('warning', `${pending.length} task(s) were not started.`)
          }
        } else {
          addLog('system', 'No tasks in this cycle — reviewing build docs only.')
        }

        await updateBuildStatus(buildId, 'review')
        addLog('success', `${buildId} moved to Review.`)

        // Refresh to show docs for review
        await refreshBuilds()
        const docs = await fetchDocs(buildId)
        setBuildDocs(docs)

        // Show available docs for review
        const docNames = Object.keys(docs).filter(name => name !== 'LOG.jsonl')
        if (docNames.length > 0) {
          addLog('system', `Review docs available: ${docNames.join(', ')}`)
        }

        if (taskList.length > 0) {
          const doneStatuses = new Set(['review', 'deployed', 'blocked'])
          const done = taskList.filter(t => doneStatuses.has(t.status))
          if (done.length === taskList.length) {
            addLog('success', 'All tasks complete — ready for review.')
          } else {
            addLog('system', 'Review started — check task results and guard status.')
          }
        } else {
          addLog('system', 'Review the build docs, then Ship It! when ready.')
        }
      } catch (err) {
        addLog('error', `Failed: ${err.message}`)
      }

    } else if (newStatus === 'deployed') {
      // Shipping — mark cycle as deployed
      addLog('system', `Preparing to ship ${buildId}...`)
      try {
        // Fetch final task state
        const res = await fetch(`/api/tasks/${buildId}`)
        const data = await res.json()
        const taskList = data.tasks || []

        if (taskList.length > 0) {
          const doneStatuses = new Set(['review', 'deployed', 'blocked'])
          const done = taskList.filter(t => doneStatuses.has(t.status))
          const blocked = taskList.filter(t => t.status === 'blocked')

          addLog('system', `Final check: ${done.length}/${taskList.length} tasks complete.`)

          if (blocked.length > 0) {
            addLog('warning', `${blocked.length} task(s) still blocked — shipping anyway.`)
          }
        }

        await updateBuildStatus(buildId, 'deployed')
        addLog('success', `${buildId} shipped!`)

        await refreshBuilds()

        // Auto-generate RECAP.md
        try {
          await fetch(`/api/tasks/builds/${buildId}/recap`, { method: 'POST' })
        } catch {
          // Non-critical — user can still write it manually
        }

        // Refresh docs to show Recap tab with generated content
        const docs = await fetchDocs(buildId)
        setBuildDocs(docs)

        addLog('success', 'RECAP.md generated — edit it in the Recap tab.')
      } catch (err) {
        addLog('error', `Failed: ${err.message}`)
      }

    } else if (newStatus === 'blocked') {
      // Moving to Stalled
      addLog('system', `Stalling ${buildId}...`)
      try {
        // Fetch task state for context
        const res = await fetch(`/api/tasks/${buildId}`)
        const data = await res.json()
        const taskList = data.tasks || []

        const running = taskList.filter(t => t.status === 'in_progress')
        const blocked = taskList.filter(t => t.status === 'blocked')

        if (running.length > 0) {
          addLog('warning', `${running.length} task(s) still running — they will be left as-is.`)
        }
        if (blocked.length > 0) {
          addLog('system', `Blocked tasks:`)
          blocked.forEach(t => addLog('warning', `  • ${t.id}: ${t.title}${t.blockedReason ? ` — ${t.blockedReason}` : ''}`))
        }

        await updateBuildStatus(buildId, 'blocked')
        addLog('success', `${buildId} moved to Stalled.`)
        addLog('system', 'Cycle stalled — needs human input before it can continue.')
        await refreshBuilds()
      } catch (err) {
        addLog('error', `Failed: ${err.message}`)
      }

    } else if (newStatus === 'pending') {
      // Resetting to Idea (backlog) — from Stalled
      addLog('system', `Resetting ${buildId} to backlog...`)
      try {
        await updateBuildStatus(buildId, 'pending')
        addLog('success', `${buildId} reset to Idea.`)
        addLog('system', 'Cycle moved back to backlog. Existing docs preserved.')
        await refreshBuilds()
      } catch (err) {
        addLog('error', `Failed: ${err.message}`)
      }
    } else {
      // Fallback for any other status transition
      addLog('system', `Moving ${buildId} to ${newStatus}...`)
      try {
        await updateBuildStatus(buildId, newStatus)
        addLog('success', `${buildId} moved to ${newStatus}.`)
        await refreshBuilds()
      } catch (err) {
        addLog('error', `Failed: ${err.message}`)
      }
    }
  }

  const handleSaveDoc = async (docName, content) => {
    if (!selectedBuildId) return
    await saveDoc(selectedBuildId, docName, content)
    // Refresh docs in sidebar
    const docs = await fetchDocs(selectedBuildId)
    setBuildDocs(docs)
  }

  const handlePatchTask = async (taskId, updates) => {
    if (!selectedBuildId) return
    await patchTask(taskId, updates)
  }

  const handleExecuteTask = async (taskId) => {
    if (!selectedBuildId) return
    addLog('system', `Starting execution of ${taskId}...`)
    try {
      await startExecution(taskId)
    } catch (err) {
      addLog('error', `Execute failed: ${err.message}`)
    }
  }

  const handleCancelTask = async (taskId) => {
    if (!selectedBuildId) return
    addLog('system', `Cancelling ${taskId}...`)
    try {
      await cancelExecution(taskId)
    } catch (err) {
      addLog('error', `Cancel failed: ${err.message}`)
    }
  }

  const handleSendChat = async (buildId, message) => {
    addLog('system', `Sending feedback for ${buildId}...`)
    // Clear pending questions since user is responding
    setPendingQuestions([])
    try {
      const result = await sendChat(buildId, message)
      // Refresh docs + tasks after feedback updates files
      const docs = await fetchDocs(buildId)
      setBuildDocs(docs)
      await refreshTasks(buildId)
      await refreshBuilds()
      return result
    } catch (err) {
      addLog('error', `Feedback failed: ${err.message}`)
      throw err
    }
  }

  const handleDeleteBuild = async (buildId) => {
    try {
      await removeBuild(buildId)
      setShowSidebar(false)
      setSelectedBuildId('')
      terminal.clear()
      setHasLogs(false)
      setBuildDocs({})
    } catch (err) {
      addLog('error', `Delete failed: ${err.message}`)
    }
  }

  const handleSelectBuild = (buildId) => {
    // Only clear logs when switching to a different build
    if (buildId !== selectedBuildId) {
      terminal.clear()
      setHasLogs(false)
      setPendingQuestions([])
    }
    setSelectedBuildId(buildId)
    setShowSidebar(true)
  }

  const selectedBuild = useMemo(
    () => builds.find(b => b.buildId === selectedBuildId) || null,
    [builds, selectedBuildId]
  )
  const effectivePendingQuestions = useMemo(() => {
    if (pendingQuestions.length > 0) return pendingQuestions
    const fromBuild = Array.isArray(selectedBuild?.openQuestions)
      ? selectedBuild.openQuestions.filter(Boolean)
      : []
    if (fromBuild.length === 0) return []
    return [{
      phase: 'planning',
      taskId: null,
      questions: fromBuild,
      timestamp: new Date().toISOString(),
    }]
  }, [pendingQuestions, selectedBuild])

  // Check if a build is currently being planned (async in flight)
  const isBuildPlanning = useCallback(
    (buildId) => planningBuilds.has(buildId),
    [planningBuilds]
  )

  const isSelectedBuildPlanning = selectedBuildId ? planningBuilds.has(selectedBuildId) : false

  if (loading) {
    return <p className="text-text-muted">Loading board...</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Board</h2>
          <p className="text-sm text-text-muted">Each cycle is a Vibe, Lite, or Full — scoped, executed, and recapped.</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold border-2 border-accent text-accent hover:bg-accent hover:text-white transition-colors"
        >
          + New Cycle
        </button>
      </div>

      {error && (
        <div className="rounded-lg border-2 border-danger/40 bg-danger/5 px-4 py-2 text-sm text-danger flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            onClick={reload}
            className="flex-shrink-0 px-3 py-1 rounded-md text-xs font-semibold border border-danger/40 hover:bg-danger/10 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {showAddModal && (
        <AddCardModal
          onClose={handleAddCardClose}
          onCreate={createBuild}
        />
      )}

      {builds.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
          <p className="text-text-muted">No cycles yet. Click <strong>+ New Cycle</strong> to get started.</p>
        </div>
      )}

      {/* Board container — columns scroll horizontally, sidebar overlays from right */}
      <div className="relative" style={{ height: 'calc(100vh - 180px)' }}>
        {/* Horizontally scrollable column area */}
        <div
          className="overflow-x-auto h-full pb-2"
          style={{
            paddingRight: showSidebar && selectedBuild && isDesktopViewport ? '432px' : '0',
            transition: 'padding-right 0.2s ease-out',
          }}
        >
          <div className="flex gap-3 h-full" style={{ minWidth: 'max-content' }}>
            {COLUMNS.map(column => (
              <TaskColumn
                key={column.status}
                title={column.title}
                tooltip={column.tooltip}
                status={column.status}
                color={column.color}
                builds={buildsByStatus[column.status]}
                selectedBuildId={selectedBuildId}
                onSelectBuild={handleSelectBuild}
                onDrop={handleDrop}
                onAddCard={column.status === 'pending' ? () => setShowAddModal(true) : null}
                isBuildPlanning={isBuildPlanning}
                onAction={handleDrop}
              />
            ))}
          </div>
        </div>

        {/* Detail sidebar — fixed overlay on the right */}
        {showSidebar && selectedBuild && (
          <div
            className={isDesktopViewport ? 'fixed top-0 right-0 h-screen w-[420px] z-40 flex flex-col sidebar-slide-in' : 'lg:hidden'}
            style={{
              boxShadow: isDesktopViewport ? '-4px 0 20px rgba(44, 24, 16, 0.12)' : undefined,
            }}
          >
            <ExecutionView
              terminal={terminal}
              hasLogs={hasLogs}
              onClose={() => setShowSidebar(false)}
              onDelete={handleDeleteBuild}
              onSaveDoc={handleSaveDoc}
              onPatchTask={handlePatchTask}
              onExecuteTask={handleExecuteTask}
              onCancelTask={handleCancelTask}
              onSendChat={handleSendChat}
              buildInfo={selectedBuild}
              tasks={tasks}
              buildDocs={buildDocs}
              isPlanning={isSelectedBuildPlanning}
              onAction={handleDrop}
              pendingQuestions={effectivePendingQuestions}
              onRefreshBuilds={refreshBuilds}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default TaskBoard
