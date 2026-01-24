<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { XCircle } from 'lucide-vue-next'
import { useEventBus } from '@/composables/useEventBus'
import { getEnv } from '@/utils/env'

interface Props {
  installationId: string
}

interface LogEntry {
  id: string
  level: string
  message: string
  created_at: string
}

const props = defineProps<Props>()
const emit = defineEmits(['next', 'cancel'])

const { t } = useI18n()
const eventBus = useEventBus()

// State
const currentStatus = ref('provisioning')
const statusMessage = ref('')
const logs = ref<LogEntry[]>([])
const error = ref<string | null>(null)

// SSE connections
let statusSource: EventSource | null = null
let logsSource: EventSource | null = null

// Status stages and progress
const statusStages: Record<string, { label: string; progress: number }> = {
  'provisioning': { label: 'Provisioning', progress: 20 },
  'connecting': { label: 'Connecting', progress: 40 },
  'discovering_tools': { label: 'Discovering Tools', progress: 60 },
  'syncing_tools': { label: 'Syncing Tools', progress: 80 },
  'online': { label: 'Online', progress: 100 }
}

const statusLabel = computed(() => {
  return statusStages[currentStatus.value]?.label || 'Unknown'
})

const statusProgress = computed(() => {
  return statusStages[currentStatus.value]?.progress || 0
})

const isOnline = computed(() => currentStatus.value === 'online')

// Log formatting helpers
function formatTime(timestamp: string) {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', { hour12: false })
}

function getLogClass(level: string) {
  switch (level) {
    case 'error': return 'text-red-400'
    case 'warn': return 'text-yellow-400'
    case 'info': return 'text-gray-100'
    case 'debug': return 'text-gray-500'
    default: return 'text-gray-100'
  }
}

function getLevelClass(level: string) {
  switch (level) {
    case 'error': return 'text-red-500'
    case 'warn': return 'text-yellow-500'
    case 'info': return 'text-blue-500'
    case 'debug': return 'text-gray-500'
    default: return 'text-gray-400'
  }
}

function handleCancel() {
  // Close streams
  if (statusSource) {
    statusSource.close()
    statusSource = null
  }
  if (logsSource) {
    logsSource.close()
    logsSource = null
  }
  emit('cancel')
}

onMounted(() => {
  const teamId = eventBus.getState<string>('selected_team_id')
  if (!teamId) {
    error.value = 'No team selected'
    return
  }

  const baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

  // Connect to status stream
  statusSource = new EventSource(
    `${baseUrl}/api/teams/${teamId}/mcp/installations/${props.installationId}/status/stream`,
    { withCredentials: true }
  )

  statusSource.addEventListener('status_update', (event) => {
    try {
      const data = JSON.parse(event.data)
      currentStatus.value = data.status
      statusMessage.value = data.status_message || ''

      // Auto-proceed when online
      if (data.status === 'online') {
        setTimeout(() => {
          emit('next')
        }, 2000) // Wait 2 seconds to show success
      }
    } catch (err) {
      console.error('Failed to parse status update:', err)
    }
  })

  statusSource.onerror = (err) => {
    console.error('Status stream error:', err)
    error.value = 'Status stream connection lost'
  }

  // Connect to logs stream
  logsSource = new EventSource(
    `${baseUrl}/api/teams/${teamId}/mcp/installations/${props.installationId}/logs/stream?limit=100`,
    { withCredentials: true }
  )

  logsSource.addEventListener('snapshot', (event) => {
    try {
      const data = JSON.parse(event.data)
      logs.value = data.logs.reverse() // Oldest first
      scrollToBottom()
    } catch (err) {
      console.error('Failed to parse logs snapshot:', err)
    }
  })

  logsSource.addEventListener('log', (event) => {
    try {
      const log = JSON.parse(event.data)
      logs.value.push(log)
      scrollToBottom()
    } catch (err) {
      console.error('Failed to parse log:', err)
    }
  })

  logsSource.onerror = (err) => {
    console.error('Logs stream error:', err)
  }
})

onUnmounted(() => {
  if (statusSource) {
    statusSource.close()
    statusSource = null
  }
  if (logsSource) {
    logsSource.close()
    logsSource = null
  }
})

function scrollToBottom() {
  setTimeout(() => {
    const container = document.querySelector('.logs-container')
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, 100)
}
</script>

<template>
  <div class="space-y-6 py-8">
    <h2 class="text-xl font-bold mb-4">{{ t('deployments.wizard.streaming.title') }}</h2>

    <!-- Error State -->
    <div v-if="error" class="mb-6">
      <div class="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-3">
        <XCircle class="h-5 w-5 text-destructive flex-shrink-0" />
        <p class="text-sm text-destructive">{{ error }}</p>
      </div>
    </div>

    <!-- Status Progress Bar -->
    <div class="bg-muted rounded-lg p-4">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium">{{ t('deployments.wizard.streaming.status') }}: {{ statusLabel }}</span>
        <span v-if="statusMessage" class="text-xs text-muted-foreground">{{ statusMessage }}</span>
      </div>
      <div class="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-2">
        <div
          class="bg-primary h-2 rounded-full transition-all duration-500"
          :style="{ width: `${statusProgress}%` }"
        ></div>
      </div>
    </div>

    <!-- Logs Stream -->
    <div class="border rounded-lg bg-gray-900 text-gray-100 p-4 h-96 overflow-y-auto font-mono text-sm logs-container">
      <div v-if="logs.length === 0" class="text-gray-500">
        {{ t('deployments.wizard.streaming.waitingForLogs') }}
      </div>
      <div v-for="log in logs" :key="log.id" :class="['py-1', getLogClass(log.level)]">
        <span class="text-gray-500">{{ formatTime(log.created_at) }}</span>
        <span :class="['ml-2 font-semibold', getLevelClass(log.level)]">{{ log.level.toUpperCase() }}</span>
        <span class="ml-2">{{ log.message }}</span>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex justify-between">
      <Button
        @click="handleCancel"
        variant="outline"
        :disabled="isOnline"
      >
        {{ t('deployments.wizard.buttons.cancel') }}
      </Button>
      <Button
        v-if="isOnline"
        @click="emit('next')"
        variant="default"
        class="bg-green-600 hover:bg-green-700"
      >
        {{ t('deployments.wizard.buttons.continue') }}
      </Button>
    </div>
  </div>
</template>
