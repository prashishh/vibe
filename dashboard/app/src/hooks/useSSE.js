import { useEffect, useRef } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''
const RETRY_BASE_DELAY = 2000
const MAX_RETRY_DELAY = 30000

export function useSSE(buildId, handlers = {}) {
  const retriesRef = useRef(0)
  const handlersRef = useRef(handlers)
  const lastEventIdRef = useRef('')

  // Keep handlers ref up-to-date without triggering reconnection
  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    if (!buildId) return undefined

    let source = null
    let retryTimer = null
    let closed = false
    lastEventIdRef.current = ''

    function connect() {
      if (closed) return

      const replayParam = lastEventIdRef.current
        ? `?lastEventId=${encodeURIComponent(lastEventIdRef.current)}`
        : ''
      source = new EventSource(`${API_BASE}/api/execution/stream/${buildId}${replayParam}`)

      // Reset retry count on successful connection
      source.addEventListener('connected', (event) => {
        retriesRef.current = 0
        const handler = handlersRef.current.onConnected
        if (typeof handler === 'function') {
          let data = null
          try {
            data = JSON.parse(event.data)
          } catch {
            data = event.data
          }
          handler(data)
        }
      })

      const eventNames = [
        ['tasks-updated', 'onTasksUpdated'],
        ['execution-log', 'onExecutionLog'],
        ['file-changed', 'onFileChanged'],
        ['guard-result', 'onGuardResult'],
        ['task-status-changed', 'onTaskStatusChanged'],
        ['build-status-changed', 'onBuildStatusChanged'],
        ['runner-questions', 'onRunnerQuestions'],
        ['stream-state', 'onStreamState'],
        ['heartbeat', 'onHeartbeat'],
      ]

      for (const [eventName, handlerKey] of eventNames) {
        source.addEventListener(eventName, (event) => {
          if (event?.lastEventId) {
            lastEventIdRef.current = event.lastEventId
          }
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

        // Reconnect with capped exponential backoff (never give up)
        const delay = Math.min(RETRY_BASE_DELAY * Math.pow(2, retriesRef.current), MAX_RETRY_DELAY)
        retriesRef.current += 1
        retryTimer = setTimeout(connect, delay)
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
