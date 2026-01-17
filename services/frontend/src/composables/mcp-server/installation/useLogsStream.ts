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

  function connect(url: string) {
    currentUrl = url
    disconnect()
    isLoading.value = true
    error.value = null

    try {
      eventSource = new EventSource(url, { withCredentials })

      // Handle initial snapshot of logs
      eventSource.addEventListener('snapshot', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          logs.value = data.logs || []
          error.value = null
          isLoading.value = false
          isConnected.value = true
        } catch (err) {
          console.error('useLogsStream: Failed to parse snapshot data:', err)
        }
      })

      // Handle new individual log entries
      eventSource.addEventListener('log', (event: MessageEvent) => {
        try {
          const newLog = JSON.parse(event.data) as McpLog
          // Prepend new log and limit to maxLogs
          logs.value = [newLog, ...logs.value].slice(0, maxLogs)
        } catch (err) {
          console.error('useLogsStream: Failed to parse log data:', err)
        }
      })

      // Handle error events from the server
      eventSource.addEventListener('error', (event: Event) => {
        try {
          const messageEvent = event as MessageEvent
          if (messageEvent.data) {
            const parsed = JSON.parse(messageEvent.data)
            error.value = parsed.error || 'Stream error'
          }
        } catch {
          // Not a JSON error event
        }
      })

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
