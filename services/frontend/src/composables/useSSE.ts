import { ref, onUnmounted, type Ref } from 'vue'

export interface UseSSEOptions {
  reconnectDelay?: number
  withCredentials?: boolean
}

export interface UseSSEReturn<T> {
  data: Ref<T | null>
  isConnected: Ref<boolean>
  isLoading: Ref<boolean>
  error: Ref<string | null>
  connect: (url: string) => void
  disconnect: () => void
}

/**
 * Composable for Server-Sent Events (SSE) connections
 *
 * @param eventName - The SSE event name to listen for
 * @param options - Configuration options
 * @returns Reactive state and control methods
 *
 * @example
 * const { data, isConnected, error, connect } = useSSE<MyData[]>('my_event')
 * onMounted(() => connect('/api/stream?param=value'))
 */
export function useSSE<T>(
  eventName: string,
  options: UseSSEOptions = {}
): UseSSEReturn<T> {
  const { reconnectDelay = 5000, withCredentials = true } = options

  const data = ref<T | null>(null) as Ref<T | null>
  const isConnected = ref(false)
  const isLoading = ref(true)
  const error = ref<string | null>(null)

  let eventSource: EventSource | null = null
  let reconnectTimeout: number | null = null
  let currentUrl: string | null = null
  let isUnloading = false

  // Close connections before page unload to prevent browser warnings
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

      eventSource.addEventListener(eventName, (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data)
          // Handle both { activities: [...] } and direct array formats
          const firstKey = Object.keys(parsed)[0]
          data.value = firstKey ? parsed[firstKey] : parsed
          error.value = null
          isLoading.value = false
          isConnected.value = true
        } catch (err) {
          console.error('useSSE: Failed to parse event data:', err)
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
      console.error('useSSE: Connection error:', err)
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
    data,
    isConnected,
    isLoading,
    error,
    connect,
    disconnect
  }
}
