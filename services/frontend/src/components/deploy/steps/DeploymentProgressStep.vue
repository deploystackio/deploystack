<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Card } from '@/components/ui/card'
import { XCircle } from 'lucide-vue-next'
import { useEventBus } from '@/composables/useEventBus'
import { useLogsStream, useStatusStream } from '@/composables/mcp-server/installation'
import { LogsTable } from '@/components/mcp-server/installation'
import InstallationStatusBadge from '@/components/mcp-server/installation/InstallationStatusBadge.vue'
import { McpLogsService } from '@/services/mcpLogsService'
import { getEnv } from '@/utils/env'
import type { InstallationStatus } from '@/types/mcp-installations'

interface Props {
  installationId: string
  repositoryName: string
  branch: string
  commitSha: string
}

const props = defineProps<Props>()
const emit = defineEmits(['deployment-online'])

const { t } = useI18n()
const eventBus = useEventBus()

// State
const currentStatus = ref<InstallationStatus>('provisioning')
const statusMessage = ref<string>('')
const error = ref<string | null>(null)

// Use composables for SSE connections
const { logs, connect: connectLogs, disconnect: disconnectLogs } = useLogsStream()
const {
  statusData,
  error: statusError,
  connect: connectStatus,
  disconnect: disconnectStatus
} = useStatusStream()

// Watch for status updates from SSE
watch(statusData, (data) => {
  if (data?.status) {
    currentStatus.value = data.status
    statusMessage.value = data.status_message || ''

    // Emit event when online
    if (data.status === 'online') {
      emit('deployment-online')
    }
  }
}, { immediate: true })

onMounted(() => {
  const tid = eventBus.getState<string>('selected_team_id')
  if (!tid) {
    error.value = 'No team selected'
    return
  }

  const baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

  // Connect to status stream
  const statusUrl = `${baseUrl}/api/teams/${tid}/mcp/installations/${props.installationId}/status/stream`
  connectStatus(statusUrl)

  // Connect to logs stream
  const logsUrl = McpLogsService.getStreamUrl(tid, props.installationId, { limit: 100 })
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

      <!-- Status List -->
      <div class="bg-white dark:bg-neutral-950 rounded-lg border border-gray-100 dark:border-gray-800 px-4 py-4">
        <div class="flex items-center justify-between">
          <div class="min-w-0 flex-auto">
            <h2 class="text-sm/6 font-semibold text-gray-900 dark:text-gray-100">
              {{ t('deployments.wizard.deployProgress.status') }}
            </h2>
          </div>
          <div class="flex-none">
            <InstallationStatusBadge
              :status-data="statusData ? {
                installation_id: installationId,
                instance_id: '',
                user_id: '',
                user_slug: '',
                status: currentStatus,
                status_message: statusMessage,
                status_updated_at: new Date().toISOString(),
                last_health_check_at: null
              } : null"
              size="sm"
            />
          </div>
        </div>
      </div>

      <!-- Logs Table -->
      <div class="mt-8">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {{ t('deployments.wizard.deployProgress.logs') }}
        </h3>
        <Card v-if="logs.length === 0" class="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          <LogsTable
            :logs="logs"
            :empty-message="t('deployments.wizard.streaming.waitingForLogs')"
            :show-header="true"
          />
        </Card>
        <LogsTable
          v-else
          :logs="logs"
          :show-header="true"
        />
      </div>
    </div>
  </div>
</template>
