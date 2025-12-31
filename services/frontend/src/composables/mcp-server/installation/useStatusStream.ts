import { ref, onUnmounted, type Ref } from 'vue'
import type { InstallationStatusData } from '@/types/mcp-installations'

export interface UseStatusStreamOptions {
  reconnectDelay?: number
  withCredentials?: boolean
}

export interface UseStatusStreamReturn {
  statusData: Ref<InstallationStatusData | null>
  isConnected: Ref<boolean>
  isLoading: Ref<boolean>
  error: Ref<string | null>
  connect: (url: string) => void
  disconnect: () => void
}

/**
 * Composable for streaming MCP installation status via Server-Sent Events
 *
 * Handles two event types from the backend:
 * - `snapshot`: Initial status snapshot
 * - `status_update`: Real-time status updates
 *
 * @param options - Configuration options
 * @returns Reactive state and control methods
 *
 * @example
 * const { statusData, isConnected, error, connect, disconnect } = useStatusStream()
 * onMounted(() => connect(`${baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/status/stream`))
 */
export function useStatusStream(
  options: UseStatusStreamOptions = {}
): UseStatusStreamReturn {
  const { reconnectDelay = 5000, withCredentials = true } = options

  const statusData = ref<InstallationStatusData | null>(null)
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

      // Handle initial snapshot
      eventSource.addEventListener('instance_snapshot', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as InstallationStatusData
          statusData.value = data
          error.value = null
          isLoading.value = false
          isConnected.value = true
        } catch (err) {
          console.error('useStatusStream: Failed to parse snapshot data:', err)
        }
      })

      // Handle status updates
      eventSource.addEventListener('instance_status_update', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as InstallationStatusData
          statusData.value = data
        } catch (err) {
          console.error('useStatusStream: Failed to parse status update:', err)
        }
      })

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

        if (isUnloading) return

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
      console.error('useStatusStream: Connection error:', err)
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
    statusData,
    isConnected,
    isLoading,
    error,
    connect,
    disconnect
  }
}
