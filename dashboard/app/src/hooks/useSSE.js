import { useEffect, useRef } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''
const MAX_RETRIES = 5
const RETRY_BASE_DELAY = 2000

export function useSSE(buildId, handlers = {}) {
  const retriesRef = useRef(0)
  const handlersRef = useRef(handlers)

  // Keep handlers ref up-to-date without triggering reconnection
  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    if (!buildId) return undefined

    let source = null
    let retryTimer = null
    let closed = false

    function connect() {
      if (closed) return

      source = new EventSource(`${API_BASE}/api/execution/stream/${buildId}`)

      // Reset retry count on successful connection
      source.addEventListener('connected', () => {
        retriesRef.current = 0
      })

      const eventNames = [
        ['tasks-updated', 'onTasksUpdated'],
        ['execution-log', 'onExecutionLog'],
        ['file-changed', 'onFileChanged'],
        ['guard-result', 'onGuardResult'],
        ['task-status-changed', 'onTaskStatusChanged'],
        ['build-status-changed', 'onBuildStatusChanged'],
        ['runner-questions', 'onRunnerQuestions'],
      ]

      for (const [eventName, handlerKey] of eventNames) {
        source.addEventListener(eventName, (event) => {
          const handler = handlersRef.current[handlerKey]
          if (typeof handler !== 'function') return
          let data = null
          try {
            data = JSON.parse(event.data)
          } catch {
            data = event.data
          }
          handler(data)
        })
      }

      source.onerror = () => {
        if (closed) return
        source.close()

        // Reconnect with exponential backoff
        if (retriesRef.current < MAX_RETRIES) {
          const delay = RETRY_BASE_DELAY * Math.pow(2, retriesRef.current)
          retriesRef.current += 1
          retryTimer = setTimeout(connect, delay)
        }
      }
    }

    connect()

    return () => {
      closed = true
      if (source) source.close()
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [buildId])
}
