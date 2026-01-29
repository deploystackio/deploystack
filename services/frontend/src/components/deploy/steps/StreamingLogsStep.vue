<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Card } from '@/components/ui/card'
import { XCircle } from 'lucide-vue-next'
import { useEventBus } from '@/composables/useEventBus'
import { useLogsStream, useStatusStream } from '@/composables/mcp-server/installation'
import { LogsTable } from '@/components/mcp-server/installation'
import { McpLogsService } from '@/services/mcpLogsService'
import { getEnv } from '@/utils/env'

interface Props {
  installationId: string
}

const props = defineProps<Props>()
const emit = defineEmits(['next', 'cancel'])

const { t } = useI18n()
const eventBus = useEventBus()

// State
const currentStatus = ref('provisioning')
const statusMessage = ref('')
const error = ref<string | null>(null)

// Use composables for SSE connections
const { logs, connect: connectLogs, disconnect: disconnectLogs } = useLogsStream()
const {
  statusData,
  error: statusError,
  connect: connectStatus,
  disconnect: disconnectStatus
} = useStatusStream()

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

// Watch for status updates from SSE
watch(statusData, (data) => {
  if (data?.status) {
    currentStatus.value = data.status
    statusMessage.value = data.status_message || ''

    // Auto-advance when online
    if (data.status === 'online') {
      setTimeout(() => {
        emit('next')
      }, 2000)
    }
  }
}, { immediate: true })


onMounted(() => {
  const teamId = eventBus.getState<string>('selected_team_id')
  if (!teamId) {
    error.value = 'No team selected'
    return
  }

  const baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

  // Connect to status stream using composable
  const statusUrl = `${baseUrl}/api/teams/${teamId}/mcp/installations/${props.installationId}/status/stream`
  connectStatus(statusUrl)

  // Connect to logs stream using composable
  const logsUrl = McpLogsService.getStreamUrl(teamId, props.installationId, { limit: 100 })
  connectLogs(logsUrl)
})

onUnmounted(() => {
  disconnectStatus()
  disconnectLogs()
})
</script>

<template>
  <div>
    <div class="space-y-6 py-8">
    <!-- Error State -->
    <div v-if="error || statusError" class="mb-6">
      <div class="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-3">
        <XCircle class="h-5 w-5 text-destructive flex-shrink-0" />
        <p class="text-sm text-destructive">{{ error || statusError }}</p>
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

    <!-- Logs Table -->
    <div>
      <!-- Empty state with border -->
      <Card v-if="logs.length === 0" class="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <LogsTable
          :logs="logs"
          :empty-message="t('deployments.wizard.streaming.waitingForLogs')"
          :show-header="true"
        />
      </Card>

      <!-- Logs table without border -->
      <LogsTable
        v-else
        :logs="logs"
        :show-header="true"
      />
    </div>
    </div>
  </div>
</template>
