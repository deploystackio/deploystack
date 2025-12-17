import { ref, onUnmounted, type Ref } from 'vue'
import type { McpRequestLog } from '@/types/mcp-request-logs'

export interface UseRequestsStreamOptions {
  reconnectDelay?: number
  withCredentials?: boolean
  maxRequests?: number
}

export interface UseRequestsStreamReturn {
  requests: Ref<McpRequestLog[]>
  isConnected: Ref<boolean>
  isLoading: Ref<boolean>
  error: Ref<string | null>
  connect: (url: string) => void
  disconnect: () => void
}

/**
 * Composable for streaming MCP request logs via Server-Sent Events
 *
 * Handles two event types from the backend:
 * - `snapshot`: Initial batch of requests
 * - `request`: Individual new request entries
 *
 * @param options - Configuration options
 * @returns Reactive state and control methods
 *
 * @example
 * const { requests, isConnected, error, connect, disconnect } = useRequestsStream()
 * onMounted(() => connect(McpRequestLogsService.getStreamUrl(teamId, installationId)))
 */
export function useRequestsStream(
  options: UseRequestsStreamOptions = {}
): UseRequestsStreamReturn {
  const { reconnectDelay = 5000, withCredentials = true, maxRequests = 100 } = options

  const requests = ref<McpRequestLog[]>([])
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

      // Handle initial snapshot of requests
      eventSource.addEventListener('snapshot', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          requests.value = data.requests || []
          error.value = null
          isLoading.value = false
          isConnected.value = true
        } catch (err) {
          console.error('useRequestsStream: Failed to parse snapshot data:', err)
        }
      })

      // Handle new individual request entries
      eventSource.addEventListener('request', (event: MessageEvent) => {
        try {
          const newRequest = JSON.parse(event.data) as McpRequestLog
          // Prepend new request and limit to maxRequests
          requests.value = [newRequest, ...requests.value].slice(0, maxRequests)
        } catch (err) {
          console.error('useRequestsStream: Failed to parse request data:', err)
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
      console.error('useRequestsStream: Connection error:', err)
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
    requests,
    isConnected,
    isLoading,
    error,
    connect,
    disconnect
  }
}
