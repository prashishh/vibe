import { useCallback, useEffect, useMemo, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`
  const method = options.method || 'GET'

  // Only set Content-Type for requests with bodies
  const headers = { ...(options.headers || {}) }
  if (options.body) {
    headers['Content-Type'] = 'application/json'
  }

  let response
  try {
    response = await fetch(url, { ...options, headers })
  } catch (networkErr) {
    throw new Error(`Network error on ${method} ${path} — is the API server running?`)
  }

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = payload.error || `${method} ${path} failed (${response.status})`
    throw new Error(message)
  }

  return payload
}

export function useTaskAPI(buildId) {
  const [builds, setBuilds] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refreshBuilds = useCallback(async () => {
    const data = await request('/api/tasks')
    setBuilds(data.builds || [])
    return data.builds || []
  }, [])

  const refreshTasks = useCallback(async (id = buildId) => {
    if (!id) return []
    try {
      const data = await request(`/api/tasks/${id}`)
      const next = data.tasks || []
      setTasks(next)
      return next
    } catch {
      // Build may not have TASKS.md yet (backlog state)
      setTasks([])
      return []
    }
  }, [buildId])

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      await refreshBuilds()
      if (buildId) {
        await refreshTasks(buildId)
      } else {
        setTasks([])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [buildId, refreshBuilds, refreshTasks])

  useEffect(() => {
    reload()
  }, [reload])

  const createTask = useCallback(async (payload) => {
    const data = await request(`/api/tasks/${buildId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    await refreshTasks(buildId)
    await refreshBuilds()
    return data.task
  }, [buildId, refreshBuilds, refreshTasks])

  const assistBuild = useCallback(async (payload) => {
    const data = await request('/api/tasks/builds/assist', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return data.suggestion
  }, [])

  const createBuild = useCallback(async (payload) => {
    const data = await request('/api/tasks/builds', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const nextBuilds = data.builds || []
    setBuilds(nextBuilds)
    return data.build
  }, [])

  const planBuild = useCallback(async (targetBuildId) => {
    const data = await request(`/api/tasks/builds/${targetBuildId}/plan`, {
      method: 'POST',
    })
    // The server returns 202 immediately (planning runs in background via SSE).
    // Don't overwrite builds here — SSE build-status-changed will trigger refreshBuilds().
    if (data.builds) {
      setBuilds(data.builds)
    }
    return data.build
  }, [])

  const updateBuildStatus = useCallback(async (targetBuildId, status) => {
    const data = await request(`/api/tasks/builds/${targetBuildId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    const nextBuilds = data.builds || []
    setBuilds(nextBuilds)
    return data.build
  }, [])

  const removeBuild = useCallback(async (targetBuildId) => {
    const data = await request(`/api/tasks/builds/${targetBuildId}`, {
      method: 'DELETE',
    })
    const nextBuilds = data.builds || []
    setBuilds(nextBuilds)
    setTasks([])
    return data.deleted
  }, [])

  const enhanceTask = useCallback(async (prompt) => {
    const data = await request(`/api/tasks/${buildId}/enhance`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    })
    return data.suggestion
  }, [buildId])

  const patchTask = useCallback(async (taskId, updates) => {
    const data = await request(`/api/tasks/${buildId}/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
    await refreshTasks(buildId)
    await refreshBuilds()
    return data.task
  }, [buildId, refreshBuilds, refreshTasks])

  const removeTask = useCallback(async (taskId) => {
    await request(`/api/tasks/${buildId}/${taskId}`, { method: 'DELETE' })
    await refreshTasks(buildId)
    await refreshBuilds()
  }, [buildId, refreshBuilds, refreshTasks])

  const reorder = useCallback(async (orderedTaskIds) => {
    await request(`/api/tasks/${buildId}/reorder`, {
      method: 'POST',
      body: JSON.stringify({ orderedTaskIds }),
    })
    await refreshTasks(buildId)
  }, [buildId, refreshTasks])

  const startExecution = useCallback(async (taskId, command) => {
    const data = await request(`/api/execution/${buildId}/${taskId}/start`, {
      method: 'POST',
      body: JSON.stringify({ command }),
    })
    return data.started
  }, [buildId])

  const cancelExecution = useCallback(async (taskId) => {
    const data = await request(`/api/execution/${buildId}/${taskId}/cancel`, {
      method: 'POST',
    })
    return data.cancelled
  }, [buildId])

  const fetchDocs = useCallback(async (targetBuildId) => {
    const id = targetBuildId || buildId
    if (!id) return {}
    const data = await request(`/api/tasks/builds/${id}/docs`)
    return data.docs || {}
  }, [buildId])

  const sendChat = useCallback(async (targetBuildId, message) => {
    const data = await request(`/api/tasks/builds/${targetBuildId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    })
    setBuilds(data.builds || [])
    return data.result
  }, [])

  const saveDoc = useCallback(async (targetBuildId, docName, content) => {
    const id = targetBuildId || buildId
    if (!id) throw new Error('No build selected')
    const data = await request(`/api/tasks/builds/${id}/docs/${docName}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    })
    // If we saved TASKS.md, refresh the parsed tasks
    if (docName === 'TASKS.md') {
      await refreshTasks(id)
      await refreshBuilds()
    }
    return data
  }, [buildId, refreshTasks, refreshBuilds])

  const value = useMemo(() => ({
    builds,
    tasks,
    loading,
    error,
    setTasks,
    reload,
    refreshBuilds,
    refreshTasks,
    createTask,
    assistBuild,
    createBuild,
    planBuild,
    updateBuildStatus,
    removeBuild,
    patchTask,
    removeTask,
    reorder,
    startExecution,
    cancelExecution,
    enhanceTask,
    fetchDocs,
    saveDoc,
    sendChat,
  }), [
    builds,
    tasks,
    loading,
    error,
    reload,
    refreshBuilds,
    refreshTasks,
    createTask,
    assistBuild,
    createBuild,
    planBuild,
    updateBuildStatus,
    removeBuild,
    patchTask,
    removeTask,
    reorder,
    startExecution,
    cancelExecution,
    enhanceTask,
    fetchDocs,
    saveDoc,
    sendChat,
  ])

  return value
}

export async function fetchLLMConfig() {
  const data = await request('/api/llm/config')
  return data.config
}

export async function saveLLMConfig(config) {
  const data = await request('/api/llm/config', {
    method: 'PUT',
    body: JSON.stringify(config),
  })
  return data.config
}

export async function testLLMConfig(profile) {
  const data = await request('/api/llm/test', {
    method: 'POST',
    body: JSON.stringify({ profile }),
  })
  return data.result
}

export async function testRunnerConfig(runner) {
  const data = await request('/api/llm/test-runner', {
    method: 'POST',
    body: JSON.stringify({ runner }),
  })
  return data.result
}
