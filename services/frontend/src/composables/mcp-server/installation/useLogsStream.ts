import { ref, onUnmounted, type Ref } from 'vue'
import type { McpLog } from '@/types/mcp-logs'

export interface UseLogsStreamOptions {
  reconnectDelay?: number
  withCredentials?: boolean
  maxLogs?: number
}

export interface UseLogsStreamReturn {
  logs: Ref<McpLog[]>
  isConnected: Ref<boolean>
  isLoading: Ref<boolean>
  error: Ref<string | null>
  connect: (url: string) => void
  disconnect: () => void
}

/**
 * Composable for streaming MCP logs via Server-Sent Events
 *
 * Handles two event types from the backend:
 * - `snapshot`: Initial batch of logs
 * - `log`: Individual new log entries
 *
 * @param options - Configuration options
 * @returns Reactive state and control methods
 *
 * @example
 * const { logs, isConnected, error, connect, disconnect } = useLogsStream()
 * onMounted(() => connect(McpLogsService.getStreamUrl(teamId, installationId)))
 */
export function useLogsStream(
  options: UseLogsStreamOptions = {}
): UseLogsStreamReturn {
  const { reconnectDelay = 5000, withCredentials = true, maxLogs = 100 } = options

  const logs = ref<McpLog[]>([])
  const isConnected = ref(false)
  const isLoading = ref(true)
  const error = ref<string | null>(null)

  let eventSource: EventSource | null = null
  let reconnectTimeout: number | null = null
  let currentUrl: string | null = null
  let isUnloading = false

  const handleBeforeUnload = () => {
    isUnloading = true
    disconnect()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleBeforeUnload)
  }

  // Named event handlers for proper cleanup
  const handleSnapshot = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      logs.value = data.logs || []
      error.value = null
      isLoading.value = false
      isConnected.value = true
    } catch (err) {
      console.error('useLogsStream: Failed to parse snapshot data:', err)
    }
  }

  const handleLog = (event: MessageEvent) => {
    try {
      const newLog = JSON.parse(event.data) as McpLog
      // Append new log and limit to maxLogs
      logs.value = [...logs.value, newLog].slice(-maxLogs)
    } catch (err) {
      console.error('useLogsStream: Failed to parse log data:', err)
    }
  }

  const handleError = (event: Event) => {
    try {
      const messageEvent = event as MessageEvent
      if (messageEvent.data) {
        const parsed = JSON.parse(messageEvent.data)
        error.value = parsed.error || 'Stream error'
      }
    } catch {
      // Not a JSON error event
    }
  }

  function connect(url: string) {
    currentUrl = url
    disconnect()
    logs.value = []  // Clear stale logs from previous connections
    isLoading.value = true
    error.value = null

    try {
      eventSource = new EventSource(url, { withCredentials })

      // Attach named event handlers
      eventSource.addEventListener('snapshot', handleSnapshot)
      eventSource.addEventListener('log', handleLog)
      eventSource.addEventListener('error', handleError)

      eventSource.onopen = () => {
        isConnected.value = true
        error.value = null
      }

      eventSource.onerror = () => {
        isConnected.value = false
        isLoading.value = false

        // Don't reconnect if page is unloading
        if (isUnloading) return

        // Schedule reconnect
        if (reconnectTimeout) clearTimeout(reconnectTimeout)
        reconnectTimeout = window.setTimeout(() => {
          if (currentUrl) {
            connect(currentUrl)
          }
        }, reconnectDelay)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to connect'
      isLoading.value = false
      console.error('useLogsStream: Connection error:', err)
    }
  }

  function disconnect() {
    if (eventSource) {
      // Remove all event listeners before closing to prevent ghost listeners
      eventSource.removeEventListener('snapshot', handleSnapshot)
      eventSource.removeEventListener('log', handleLog)
      eventSource.removeEventListener('error', handleError)
      eventSource.close()
      eventSource = null
    }
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
    isConnected.value = false
  }

  onUnmounted(() => {
    disconnect()
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  })

  return {
    logs,
    isConnected,
    isLoading,
    error,
    connect,
    disconnect
  }
}
