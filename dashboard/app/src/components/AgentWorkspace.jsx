import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BuildSidebar from './BuildSidebar.jsx'
import BuildDetailPanel from './BuildDetailPanel.jsx'
import AgentPanel from './AgentPanel.jsx'
import AddCardModal from './AddCardModal.jsx'
import { useTaskAPI } from '../hooks/useTaskAPI.js'
import { useSSE } from '../hooks/useSSE.js'

// Max live lines to keep in memory (prevent unbounded growth)
const MAX_LIVE_LINES = 500

const STORAGE_KEY = 'vibe-selected-build'

function AgentWorkspace() {
  const { buildId: urlBuildId } = useParams()
  const navigate = useNavigate()

  const [selectedBuildId, setSelectedBuildId] = useState(() => {
    // URL param takes priority, then localStorage fallback
    if (urlBuildId) return urlBuildId
    try { return localStorage.getItem(STORAGE_KEY) || '' } catch { return '' }
  })
  const [showAddModal, setShowAddModal] = useState(false)
  const [hasLogsByBuild, setHasLogsByBuild] = useState({})
  const [planningBuilds, setPlanningBuilds] = useState(new Set())
  const [buildDocs, setBuildDocs] = useState({})
  const [pendingQuestions, setPendingQuestions] = useState([])
  const [questionsDismissed, setQuestionsDismissed] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [isAgentThinking, setIsAgentThinking] = useState(false)
  const [liveLines, setLiveLines] = useState([])
  const pendingActivityRef = useRef([])

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
    generalChat,
    fetchChatHistory,
    patchTask,
    startExecution,
    cancelExecution,
  } = useTaskAPI(selectedBuildId)

  // ── SSE handlers ────────────────────────────────────────────────────────────
  const onTasksUpdated = useCallback((payload) => {
    if (!payload?.tasks) return
    setTasks(payload.tasks)
  }, [setTasks])

  const onTaskStatusChanged = useCallback((payload) => {
    if (!payload?.taskId || !payload?.status) return
    setTasks(prev => {
      const updated = prev.map(task => (
        task.id === payload.taskId
          ? { ...task, status: payload.status, blockedReason: payload.blockedReason || task.blockedReason }
          : task
      ))
      // If no tasks are in_progress anymore, clear thinking state
      const stillRunning = updated.some(t => t.status === 'in_progress')
      if (!stillRunning) {
        setIsAgentThinking(false)
      }
      return updated
    })
  }, [setTasks])

  const onExecutionLog = useCallback((payload) => {
    if (!payload?.message && payload?.message !== '') return
    const payloadBuildId = payload.buildId || selectedBuildId || ''
    // Only show logs for the currently selected build
    if (payloadBuildId && payloadBuildId !== selectedBuildId) return

    const stream = payload.stream || 'log'
    const msg = String(payload.message || '')
    const ts = payload.timestamp || new Date().toISOString()

    // Split on newlines so each line renders separately in the live output.
    // The stream-parser emits multi-line deltas (e.g. tool_use blocks, file content).
    const rawLines = msg.split('\n')
    const nonEmpty = rawLines.filter(l => l.trim())

    if (nonEmpty.length > 0) {
      setLiveLines(prev => {
        const additions = nonEmpty.map(line => ({ stream, message: line, timestamp: ts }))
        const next = [...prev, ...additions]
        if (next.length > MAX_LIVE_LINES) return next.slice(-MAX_LIVE_LINES)
        return next
      })
    }

    // Also collect structured activity items for the final assistant message
    if (msg.trim()) {
      let activityType = null
      if (stream === 'system' && msg.startsWith('\u2500\u2500')) activityType = 'tool-use'
      else if (stream === 'success' && msg.includes('$')) activityType = 'cost'
      else if (stream === 'error' || stream === 'stderr') activityType = 'error'
      else if (stream === 'system') activityType = 'system'

      if (activityType) {
        pendingActivityRef.current.push({
          type: activityType,
          detail: msg.trim(),
          timestamp: ts,
        })
      }
    }

    if (payloadBuildId) {
      setHasLogsByBuild(prev => {
        if (prev[payloadBuildId]) return prev
        return { ...prev, [payloadBuildId]: true }
      })
    }
  }, [selectedBuildId])

  const onBuildStatusChanged = useCallback((payload) => {
    refreshBuilds()
    if (payload?.buildId) {
      setPlanningBuilds(prev => {
        if (!prev.has(payload.buildId)) return prev
        const next = new Set(prev)
        next.delete(payload.buildId)
        return next
      })
      // Clear thinking state when a build status transition completes
      if (payload.buildId === selectedBuildId) {
        setIsAgentThinking(false)
      }
      if (payload.status === 'planning' || payload.status === 'blocked') {
        refreshTasks(payload.buildId)
        fetchDocs(payload.buildId).then(docs => setBuildDocs(docs)).catch(() => {})
      }
    }
  }, [selectedBuildId, refreshBuilds, refreshTasks, fetchDocs])

  const onChatMessage = useCallback((payload) => {
    if (!payload?.id) return

    let message = { ...payload }

    // Attach accumulated activity to assistant messages
    if (payload.role === 'assistant' && pendingActivityRef.current.length > 0) {
      message.activity = [
        ...(payload.activity || []),
        ...pendingActivityRef.current,
      ]
      pendingActivityRef.current = []
    }

    setChatMessages(prev => {
      // Deduplicate by id
      if (prev.some(m => m.id === payload.id)) return prev
      return [...prev, message]
    })

    if (payload.role === 'assistant') {
      setIsAgentThinking(false)
    }
  }, [])

  const onConnected = useCallback((payload) => {
    const buildId = payload?.buildId || selectedBuildId
    refreshBuilds()
    if (buildId) {
      refreshTasks(buildId)
      fetchDocs(buildId).then(docs => setBuildDocs(docs)).catch(() => {})
      fetchChatHistory(buildId).then(msgs => setChatMessages(msgs)).catch(() => {})
    }
  }, [selectedBuildId, refreshBuilds, refreshTasks, fetchDocs, fetchChatHistory])

  const onStreamState = useCallback((payload) => {
    const buildId = payload?.buildId || selectedBuildId || ''
    if (!buildId) return

    if (Number(payload?.replayedLogs || 0) > 0) {
      setHasLogsByBuild(prev => {
        if (prev[buildId]) return prev
        return { ...prev, [buildId]: true }
      })
    }

    refreshTasks(buildId)
    fetchDocs(buildId).then(docs => setBuildDocs(docs)).catch(() => {})
  }, [selectedBuildId, refreshTasks, fetchDocs])

  const onRunnerQuestions = useCallback((payload) => {
    if (!payload?.questions?.length) return
    // Only accept questions for the currently selected build
    const questionBuildId = payload.buildId || ''
    if (questionBuildId && questionBuildId !== selectedBuildId) return

    const cleanedQuestions = payload.questions
      .map(q => String(q || '').replace(/\s+/g, ' ').trim())
      .filter(q => q && q !== '?')
    if (cleanedQuestions.length === 0) return
    const phase = payload.phase || 'unknown'
    const taskId = payload.taskId || null
    const signature = `${phase}:${taskId || ''}:${cleanedQuestions.join(' | ')}`
    setQuestionsDismissed(false) // New questions arrived — show them
    setPendingQuestions(prev => {
      const hasSame = prev.some(item => {
        const itemQuestions = Array.isArray(item?.questions) ? item.questions : []
        const itemSignature = `${item?.phase || 'unknown'}:${item?.taskId || ''}:${itemQuestions.join(' | ')}`
        return itemSignature === signature
      })
      if (hasSame) return prev
      return [
        ...prev.slice(-19),
        {
          phase,
          taskId,
          questions: cleanedQuestions,
          timestamp: payload.timestamp || new Date().toISOString(),
        },
      ]
    })
  }, [selectedBuildId])

  useSSE(selectedBuildId, {
    onConnected,
    onTasksUpdated,
    onTaskStatusChanged,
    onExecutionLog,
    onBuildStatusChanged,
    onRunnerQuestions,
    onStreamState,
    onChatMessage,
  })

  // ── Sync URL → state: if on root `/`, always clear selection ───────────────
  useEffect(() => {
    if (!urlBuildId && selectedBuildId) {
      // We're on root, clear any stale selection
      setSelectedBuildId('')
      setChatMessages([])
      setLiveLines([])
      setPendingQuestions([])
      setQuestionsDismissed(false)
      pendingActivityRef.current = []
      setIsAgentThinking(false)
    } else if (urlBuildId && urlBuildId !== selectedBuildId) {
      // URL has a buildId that differs from state
      setSelectedBuildId(urlBuildId)
    }
  }, [urlBuildId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Redirect if URL buildId doesn't exist in builds list ──────────────────
  useEffect(() => {
    if (urlBuildId && !loading && builds.length > 0) {
      const exists = builds.some(b => b.buildId === urlBuildId)
      if (!exists) {
        navigate('/', { replace: true })
      }
    }
  }, [urlBuildId, builds, loading, navigate])

  // ── Persist selected build to localStorage ─────────────────────────────────
  useEffect(() => {
    try {
      if (selectedBuildId) localStorage.setItem(STORAGE_KEY, selectedBuildId)
      else localStorage.removeItem(STORAGE_KEY)
    } catch { /* ignore */ }
  }, [selectedBuildId])

  // ── Load chat history on mount if build was restored from URL ──────────────
  const mountedRef = useRef(false)
  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    if (selectedBuildId) {
      fetchChatHistory(selectedBuildId).then(msgs => setChatMessages(msgs)).catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Side effects ────────────────────────────────────────────────────────────
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

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const addSystemMessage = useCallback((content) => {
    setChatMessages(prev => [...prev, {
      id: `msg-sys-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      role: 'system',
      content,
      timestamp: new Date().toISOString(),
      activity: [],
    }])
  }, [])

  const addLog = (stream, message) => {
    // For the agent panel, we add system messages to the chat thread
    if (stream === 'system' || stream === 'success' || stream === 'warning' || stream === 'error') {
      addSystemMessage(message)
    }
    if (selectedBuildId) {
      setHasLogsByBuild(prev => {
        if (prev[selectedBuildId]) return prev
        return { ...prev, [selectedBuildId]: true }
      })
    }
  }

  // ── Status transition handler (replaces handleDrop) ─────────────────────────
  const handleStatusTransition = async (buildId, newStatus, currentStatus) => {
    setSelectedBuildId(buildId)

    if (currentStatus === 'pending' && newStatus === 'planning') {
      if (planningBuilds.has(buildId)) {
        addLog('system', `${buildId} is already being planned...`)
        return
      }
      setPlanningBuilds(prev => new Set(prev).add(buildId))
      setLiveLines([]) // Clear previous output
      setIsAgentThinking(true) // Show live output stream
      addLog('system', `Starting planning for ${buildId}...`)
      try {
        await planBuild(buildId)
        // Immediately refresh so the build moves from Backlog -> Planning in sidebar
        await refreshBuilds()
      } catch (err) {
        addLog('error', `Planning failed: ${err.message}`)
        setIsAgentThinking(false)
        setPlanningBuilds(prev => {
          const next = new Set(prev)
          next.delete(buildId)
          return next
        })
      }
    } else if (newStatus === 'planning' && currentStatus !== 'pending') {
      addLog('system', `Restoring ${buildId} to Planning...`)
      try {
        await updateBuildStatus(buildId, 'planning')
        addLog('success', `${buildId} restored to Planning.`)
        await refreshBuilds()
        await refreshTasks(buildId)
        const docs = await fetchDocs(buildId)
        setBuildDocs(docs)
        addLog('system', 'Existing plan docs preserved \u2014 ready to start building.')
      } catch (err) {
        addLog('error', `Failed: ${err.message}`)
      }
    } else if (newStatus === 'in_progress') {
      const isRetry = currentStatus === 'in_progress'
      setLiveLines([])
      setIsAgentThinking(true)
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
        await refreshTasks(buildId)
        await refreshBuilds()

        const res = await fetch(`/api/tasks/${buildId}`)
        const data = await res.json()
        const taskList = data.tasks || []

        const doneStatuses = new Set(['review', 'deployed', 'blocked'])
        const pendingTasks = taskList.filter(t => t.status === 'pending')
        const runningTasks = taskList.filter(t => t.status === 'in_progress')
        const doneTasks = taskList.filter(t => doneStatuses.has(t.status))

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

        addLog('system', `Queueing ${pendingTasks.length} pending task(s) on server (max 2 at a time)...`)

        const queueRes = await fetch(`/api/execution/${buildId}/start-pending`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ maxConcurrent: 2, statuses: ['pending'] }),
        })
        const queueData = await queueRes.json().catch(() => ({}))
        if (!queueRes.ok) {
          throw new Error(queueData.error || `Failed to queue pending tasks for ${buildId}`)
        }

        const enqueuedCount = Number(queueData?.queued?.enqueuedCount || 0)
        const queueState = queueData?.queued?.queue
        if (enqueuedCount === 0) {
          addLog('system', 'No new tasks were enqueued (they may already be running or completed).')
        } else {
          addLog('success', `Enqueued ${enqueuedCount} task(s).`)
          if (queueState?.runningCount > 0) {
            addLog('system', `${queueState.runningCount} task(s) running now; remaining tasks will auto-start as slots free up.`)
          }
        }
      } catch (err) {
        addLog('error', `Failed: ${err.message}`)
      }
    } else if (newStatus === 'review') {
      addLog('system', `Starting review for ${buildId}...`)
      try {
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
            addLog('warning', `${running.length} task(s) still running \u2014 they will continue in background.`)
          }
          if (blocked.length > 0) {
            addLog('warning', `${blocked.length} task(s) are blocked:`)
            blocked.forEach(t => addLog('warning', `  \u2022 ${t.id}: ${t.title}${t.blockedReason ? ` \u2014 ${t.blockedReason}` : ''}`))
          }
          if (pending.length > 0) {
            addLog('warning', `${pending.length} task(s) were not started.`)
          }
        } else {
          addLog('system', 'No tasks in this cycle \u2014 reviewing build docs only.')
        }

        await updateBuildStatus(buildId, 'review')
        addLog('success', `${buildId} moved to Review.`)

        await refreshBuilds()
        const docs = await fetchDocs(buildId)
        setBuildDocs(docs)

        const docNames = Object.keys(docs).filter(name => name !== 'LOG.jsonl')
        if (docNames.length > 0) {
          addLog('system', `Review docs available: ${docNames.join(', ')}`)
        }

        if (taskList.length > 0) {
          const doneStatuses = new Set(['review', 'deployed', 'blocked'])
          const done = taskList.filter(t => doneStatuses.has(t.status))
          if (done.length === taskList.length) {
            addLog('success', 'All tasks complete \u2014 ready for review.')
          } else {
            addLog('system', 'Review started \u2014 check task results and guard status.')
          }
        } else {
          addLog('system', 'Review the build docs, then Ship It! when ready.')
        }
      } catch (err) {
        addLog('error', `Failed: ${err.message}`)
      }
    } else if (newStatus === 'deployed') {
      addLog('system', `Preparing to ship ${buildId}...`)
      try {
        const res = await fetch(`/api/tasks/${buildId}`)
        const data = await res.json()
        const taskList = data.tasks || []

        if (taskList.length > 0) {
          const doneStatuses = new Set(['review', 'deployed', 'blocked'])
          const done = taskList.filter(t => doneStatuses.has(t.status))
          const blocked = taskList.filter(t => t.status === 'blocked')

          addLog('system', `Final check: ${done.length}/${taskList.length} tasks complete.`)

          if (blocked.length > 0) {
            addLog('warning', `${blocked.length} task(s) still blocked \u2014 shipping anyway.`)
          }
        }

        await updateBuildStatus(buildId, 'deployed')
        addLog('success', `${buildId} shipped!`)

        await refreshBuilds()

        try {
          await fetch(`/api/tasks/builds/${buildId}/recap`, { method: 'POST' })
        } catch {
          // Non-critical
        }

        const docs = await fetchDocs(buildId)
        setBuildDocs(docs)

        addLog('success', 'RECAP.md generated \u2014 edit it in the Recap tab.')
      } catch (err) {
        addLog('error', `Failed: ${err.message}`)
      }
    } else if (newStatus === 'blocked') {
      addLog('system', `Stalling ${buildId}...`)
      try {
        const res = await fetch(`/api/tasks/${buildId}`)
        const data = await res.json()
        const taskList = data.tasks || []

        const running = taskList.filter(t => t.status === 'in_progress')
        const blocked = taskList.filter(t => t.status === 'blocked')

        if (running.length > 0) {
          addLog('warning', `${running.length} task(s) still running \u2014 they will be left as-is.`)
        }
        if (blocked.length > 0) {
          addLog('system', 'Blocked tasks:')
          blocked.forEach(t => addLog('warning', `  \u2022 ${t.id}: ${t.title}${t.blockedReason ? ` \u2014 ${t.blockedReason}` : ''}`))
        }

        await updateBuildStatus(buildId, 'blocked')
        addLog('success', `${buildId} moved to Stalled.`)
        addLog('system', 'Cycle stalled \u2014 needs human input before it can continue.')
        await refreshBuilds()
      } catch (err) {
        addLog('error', `Failed: ${err.message}`)
      }
    } else if (newStatus === 'pending') {
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

  // ── Other handlers ──────────────────────────────────────────────────────────
  const handleSaveDoc = async (docName, content) => {
    if (!selectedBuildId) return
    await saveDoc(selectedBuildId, docName, content)
    const docs = await fetchDocs(selectedBuildId)
    setBuildDocs(docs)
  }

  const handlePatchTask = async (taskId, updates) => {
    if (!selectedBuildId) return
    await patchTask(taskId, updates)
  }

  const handleExecuteTask = async (taskId) => {
    if (!selectedBuildId) return
    setLiveLines([])
    setIsAgentThinking(true)
    addLog('system', `Starting execution of ${taskId}...`)
    try {
      await startExecution(taskId)
    } catch (err) {
      addLog('error', `Execute failed: ${err.message}`)
      setIsAgentThinking(false)
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

  const handleSendChat = async (message) => {
    if (!selectedBuildId) return
    setPendingQuestions([])
    setQuestionsDismissed(true)
    pendingActivityRef.current = []
    setLiveLines([]) // Clear live output for new interaction
    setIsAgentThinking(true)

    try {
      const result = await sendChat(selectedBuildId, message)
      const docs = await fetchDocs(selectedBuildId)
      setBuildDocs(docs)
      await refreshTasks(selectedBuildId)
      await refreshBuilds()
      // Clear thinking state on success. The SSE chat-message event
      // may have already cleared it, but this ensures it doesn't stick
      // if the SSE event is delayed or lost.
      setIsAgentThinking(false)
      setLiveLines([])
      return result
    } catch (err) {
      setIsAgentThinking(false)
      addSystemMessage(`Error: ${err.message}`)
      throw err
    }
  }

  // General chat when no build is selected — CLI runner handles everything
  const handleGeneralChat = async (message) => {
    // Add user message to chat thread
    setChatMessages(prev => [...prev, {
      id: `msg-user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      activity: [],
    }])
    setIsAgentThinking(true)
    setLiveLines([])

    try {
      // Pass recent chat messages for multi-turn context
      const recentHistory = chatMessages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }))
      const result = await generalChat(message, recentHistory)

      if (result.action === 'create_build') {
        // CLI runner detected build intent — proceed with auto-create + plan
        setIsAgentThinking(false)
        await handleCommand({ command: 'new', description: result.description || message, buildType: 'vibe' })
        return
      }

      // Conversational response — add to chat thread
      setIsAgentThinking(false)
      setLiveLines([])
      setChatMessages(prev => [...prev, {
        id: `msg-asst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        role: 'assistant',
        content: result.response || 'I can help you with that. Try describing what you want to build.',
        timestamp: new Date().toISOString(),
        activity: [],
      }])
    } catch (err) {
      setIsAgentThinking(false)
      setLiveLines([])
      // Show error in chat instead of silently creating a build
      setChatMessages(prev => [...prev, {
        id: `msg-err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        role: 'assistant',
        content: `Sorry, I couldn't process that: ${err.message}. Make sure your CLI runner is installed and configured in Settings.`,
        timestamp: new Date().toISOString(),
        activity: [],
      }])
    }
  }

  const handleDeleteBuild = async (buildId) => {
    try {
      await removeBuild(buildId)
      setSelectedBuildId('')
      navigate('/')
      setChatMessages([])
      setLiveLines([])
      setHasLogsByBuild(prev => {
        if (!prev[buildId]) return prev
        const next = { ...prev }
        delete next[buildId]
        return next
      })
      setBuildDocs({})
    } catch (err) {
      addLog('error', `Delete failed: ${err.message}`)
    }
  }

  const handleSelectBuild = (buildId) => {
    if (buildId !== selectedBuildId) {
      setChatMessages([])
      setLiveLines([])
      setPendingQuestions([])
      setQuestionsDismissed(false)
      pendingActivityRef.current = []
      setIsAgentThinking(false)
      if (buildId) {
        fetchChatHistory(buildId).then(msgs => setChatMessages(msgs)).catch(() => {})
      }
    }
    setSelectedBuildId(buildId)
    // Sync URL
    if (buildId) {
      navigate(`/cycle/${buildId}`)
    } else {
      navigate('/')
    }
  }

  const handleCloseCycle = () => {
    setChatMessages([])
    setLiveLines([])
    setPendingQuestions([])
    setQuestionsDismissed(false)
    pendingActivityRef.current = []
    setIsAgentThinking(false)
    setSelectedBuildId('')
    navigate('/')
  }

  const handleAddCardClose = async (build, startNow = false) => {
    setShowAddModal(false)
    if (build?.buildId) {
      await refreshBuilds()
      setSelectedBuildId(build.buildId)
      navigate(`/cycle/${build.buildId}`)
      if (startNow) {
        // Immediately start planning
        await handleStatusTransition(build.buildId, 'planning', 'pending')
      }
    }
  }

  // ── Derived state ───────────────────────────────────────────────────────────
  const selectedBuild = useMemo(
    () => builds.find(b => b.buildId === selectedBuildId) || null,
    [builds, selectedBuildId]
  )

  const effectivePendingQuestions = useMemo(() => {
    if (pendingQuestions.length > 0) return pendingQuestions
    // If user already answered (dismissed), don't fall back to stale build object questions
    if (questionsDismissed) return []
    const fromBuild = Array.isArray(selectedBuild?.needsInputQuestions) && selectedBuild.needsInputQuestions.length > 0
      ? selectedBuild.needsInputQuestions.filter(Boolean)
      : (Array.isArray(selectedBuild?.openQuestions) ? selectedBuild.openQuestions.filter(Boolean) : [])
    if (fromBuild.length === 0) return []
    return [{
      phase: selectedBuild?.needsInputPhase || 'planning',
      taskId: null,
      questions: fromBuild,
      timestamp: new Date().toISOString(),
    }]
  }, [pendingQuestions, questionsDismissed, selectedBuild])

  const isSelectedBuildPlanning = selectedBuildId ? planningBuilds.has(selectedBuildId) : false
  const runningCount = useMemo(
    () => (tasks || []).filter(t => t.status === 'in_progress').length,
    [tasks]
  )

  // ── Command handler (dispatches slash commands to API operations) ──────────
  const handleCommand = useCallback(async (parsed) => {
    const msg = (content) => addSystemMessage(content)

    switch (parsed.command) {
      case 'new': {
        if (!parsed.description) {
          msg('Usage: /new <description> [--type vibe|lite|full]')
          return
        }
        msg(`Creating new cycle: "${parsed.description}"...`)
        try {
          const build = await createBuild({
            description: parsed.description,
            buildType: parsed.buildType,
          })
          await refreshBuilds()
          setSelectedBuildId(build.buildId)
          navigate(`/cycle/${build.buildId}`)
          // Load fresh chat for the new build
          setChatMessages([])
          setLiveLines([])
          msg(`Created ${build.buildId} — starting planning...`)
          // Auto-start planning so the agent begins working immediately
          await handleStatusTransition(build.buildId, 'planning', 'pending')
        } catch (err) {
          msg(`Failed to create cycle: ${err.message}`)
        }
        break
      }

      case 'plan': {
        const buildId = parsed.buildId || selectedBuildId
        if (!buildId) { msg('No build selected.'); return }
        const build = builds.find(b => b.buildId === buildId)
        if (!build) { msg(`Build "${buildId}" not found.`); return }
        await handleStatusTransition(buildId, 'planning', build.status)
        break
      }

      case 'build': {
        const buildId = parsed.buildId || selectedBuildId
        if (!buildId) { msg('No build selected.'); return }
        const build = builds.find(b => b.buildId === buildId)
        if (!build) { msg(`Build "${buildId}" not found.`); return }
        await handleStatusTransition(buildId, 'in_progress', build.status)
        break
      }

      case 'review': {
        const buildId = parsed.buildId || selectedBuildId
        if (!buildId) { msg('No build selected.'); return }
        const build = builds.find(b => b.buildId === buildId)
        if (!build) { msg(`Build "${buildId}" not found.`); return }
        await handleStatusTransition(buildId, 'review', build.status)
        break
      }

      case 'ship': {
        const buildId = parsed.buildId || selectedBuildId
        if (!buildId) { msg('No build selected.'); return }
        const build = builds.find(b => b.buildId === buildId)
        if (!build) { msg(`Build "${buildId}" not found.`); return }
        await handleStatusTransition(buildId, 'deployed', build.status)
        break
      }

      case 'stall': {
        const buildId = parsed.buildId || selectedBuildId
        if (!buildId) { msg('No build selected.'); return }
        const build = builds.find(b => b.buildId === buildId)
        if (!build) { msg(`Build "${buildId}" not found.`); return }
        await handleStatusTransition(buildId, 'blocked', build.status)
        break
      }

      case 'status': {
        const buildId = parsed.buildId || selectedBuildId
        if (!buildId) { msg('No build selected.'); return }
        const build = builds.find(b => b.buildId === buildId)
        if (!build) { msg(`Build "${buildId}" not found.`); return }
        msg(`**${build.buildId}**: ${build.description || '(no description)'}\nStatus: ${build.status} | Type: ${build.buildType || 'vibe'}\nTasks: ${build.doneTasks || 0}/${build.totalTasks || 0} done${build.prUrl ? `\nPR: ${build.prUrl}` : ''}`)
        break
      }

      case 'select': {
        if (!parsed.buildId) { msg('Usage: /select <buildId>'); return }
        const build = builds.find(b => b.buildId === parsed.buildId)
        if (!build) { msg(`Build "${parsed.buildId}" not found.`); return }
        handleSelectBuild(parsed.buildId)
        break
      }

      case 'list': {
        const filtered = parsed.statusFilter
          ? builds.filter(b => b.status === parsed.statusFilter)
          : builds
        if (filtered.length === 0) {
          msg(parsed.statusFilter
            ? `No cycles with status "${parsed.statusFilter}".`
            : 'No cycles yet. Describe what you want to build to get started.')
          return
        }
        const lines = filtered.map(b => {
          const marker = b.buildId === selectedBuildId ? ' \u2190' : ''
          return `\u2022 **${b.buildId}**${marker} \u2014 ${b.status} \u2014 ${b.description || '(no description)'}`
        })
        msg(`Cycles${parsed.statusFilter ? ` (${parsed.statusFilter})` : ''}:\n${lines.join('\n')}`)
        break
      }

      case 'clear':
        setChatMessages([])
        setLiveLines([])
        break

      case 'help':
        msg('**Commands:**\n' +
          '`/new <desc>` \u2014 Create a new cycle\n' +
          '`/plan` \u2014 Start planning\n' +
          '`/build` \u2014 Start building\n' +
          '`/review` \u2014 Move to review\n' +
          '`/ship` \u2014 Ship / deploy\n' +
          '`/status` \u2014 Show cycle info\n' +
          '`/list` \u2014 List all cycles\n' +
          '`/clear` \u2014 Clear messages\n\n' +
          'Or just type naturally \u2014 the agent understands.')
        break

      case 'unknown':
        msg(`Unknown command: ${parsed.raw.split(' ')[0]}. Type /help for commands.`)
        break
    }
  }, [selectedBuildId, builds, createBuild, refreshBuilds, handleStatusTransition, handleSelectBuild, addSystemMessage, navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-73px)] bg-surface">
        <p className="text-text-muted">Loading...</p>
      </div>
    )
  }

  return (
    <>
      {/* Full-width horizontal layout: Sidebar | Content | Agent */}
      <div className="flex h-[calc(100vh-73px)]">
        <BuildSidebar
          builds={builds}
          selectedBuildId={selectedBuildId}
          onSelectBuild={handleSelectBuild}
          planningBuilds={planningBuilds}
          onNewCycle={() => setShowAddModal(true)}
        />

        {/* Center content area */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {selectedBuild ? (
            <BuildDetailPanel
              onDelete={handleDeleteBuild}
              onClose={handleCloseCycle}
              onSaveDoc={handleSaveDoc}
              onPatchTask={handlePatchTask}
              onExecuteTask={handleExecuteTask}
              onCancelTask={handleCancelTask}
              buildInfo={selectedBuild}
              tasks={tasks}
              buildDocs={buildDocs}
              isPlanning={isSelectedBuildPlanning}
              onAction={handleStatusTransition}
              onRefreshBuilds={refreshBuilds}
              pendingQuestions={effectivePendingQuestions}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-surface">
              <img src="/mascot/happy.png" alt="Vibe Parrot" className="w-20 h-20 object-contain mb-4 opacity-80" />
              <button
                onClick={() => setShowAddModal(true)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent-hover transition-colors"
              >
                + New Cycle
              </button>
              <p className="text-sm text-text-secondary mt-3">
                or describe what you want to build in the agent panel
              </p>
              {error && (
                <div className="mt-4 rounded-lg border border-danger/40 bg-danger/5 px-4 py-2 text-sm text-danger flex items-center gap-3">
                  <span>{error}</span>
                  <button
                    onClick={reload}
                    className="flex-shrink-0 px-3 py-1 rounded-md text-xs font-semibold border border-danger/40 hover:bg-danger/10 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right panel: always-visible agent panel */}
        <div className="relative flex-shrink-0">
          <AgentPanel
            messages={chatMessages}
            liveLines={liveLines}
            buildId={selectedBuildId}
            onSendMessage={handleSendChat}
            onCommand={handleCommand}
            onGeneralChat={handleGeneralChat}
            isThinking={isAgentThinking}
            pendingQuestions={effectivePendingQuestions}
            isPlanning={isSelectedBuildPlanning}
            runningCount={runningCount}
          />
        </div>
      </div>

      {showAddModal && (
        <AddCardModal
          onClose={handleAddCardClose}
          onCreate={createBuild}
        />
      )}
    </>
  )
}

export default AgentWorkspace
