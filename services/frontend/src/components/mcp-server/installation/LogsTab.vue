<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { useLogsStream } from '@/composables/mcp-server/installation'
import { McpLogsService } from '@/services/mcpLogsService'
import { LogsNoAccess, LogsTable } from '@/components/mcp-server/installation'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { AlertCircle, Radio } from 'lucide-vue-next'
import type { McpInstallation } from '@/types/mcp-installations'

interface Props {
  installation: McpInstallation
  teamId: string
  userTeamRole?: 'team_admin' | 'team_user' | null
}

const props = defineProps<Props>()
const { t } = useI18n()

const { logs, isConnected, isLoading, error, connect, disconnect } = useLogsStream()

type FilterType = 'all' | 'info' | 'warn' | 'error' | 'debug'
type ViewMode = 'live' | 'api'
const filter = ref<FilterType>('all')
const viewMode = ref<ViewMode>('live')

// Filtered logs based on filter selection
const filteredLogs = computed(() => {
  if (filter.value === 'all') return logs.value
  return logs.value.filter(log => log.level === filter.value)
})

// Connect to SSE stream
function connectStream() {
  // Note: We filter client-side for better UX, so we don't pass level filter to stream
  const url = McpLogsService.getStreamUrl(props.teamId, props.installation.id, { limit: 100 })
  connect(url)
}

// Watch for view mode changes and show toast
watch(viewMode, (newMode, oldMode) => {
  if (!oldMode) return // Skip initial mount

  if (newMode === 'live') {
    connectStream()
    toast.success(t('mcpInstallations.details.logs.viewMode.switchedToLive'), {
      description: t('mcpInstallations.details.logs.viewMode.liveDescription')
    })
  } else if (newMode === 'api') {
    disconnect()
    toast(t('mcpInstallations.details.logs.viewMode.switchedToApi'), {
      description: t('mcpInstallations.details.logs.viewMode.apiDescription')
    })
  }
})

onMounted(() => {
  // Only connect if user is admin
  if (props.userTeamRole === 'team_admin') {
    connectStream()
  }
})

onUnmounted(() => {
  disconnect()
})
</script>

<template>
  <div>
    <!-- No Access State for Non-Admin Users -->
    <LogsNoAccess v-if="userTeamRole !== 'team_admin'" />

    <!-- Logs Content for Admin Users -->
    <div v-else>
      <!-- Error State (outside card) -->
      <Alert v-if="error" variant="destructive" class="mb-6">
        <AlertCircle class="h-4 w-4" />
        <AlertDescription>
          {{ t('mcpInstallations.details.logs.error.description', { error }) }}
        </AlertDescription>
      </Alert>

      <!-- Main Card -->
      <Card v-else class="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 p-0 gap-0">
        <!-- Header with live indicator, view mode and filter -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div class="flex items-center gap-2">
            <div
              v-if="viewMode === 'live'"
              class="flex items-center gap-1.5 text-sm"
              :class="isConnected ? 'text-green-600' : 'text-muted-foreground'"
            >
              <Radio class="h-3 w-3" :class="{ 'animate-pulse': isConnected }" />
              <span v-if="isConnected">{{ t('mcpInstallations.details.logs.connection.live') }}</span>
              <span v-else-if="isLoading">{{ t('mcpInstallations.details.logs.connection.reconnecting') }}</span>
              <span v-else>{{ t('mcpInstallations.details.logs.connection.disconnected') }}</span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <Select v-model="viewMode">
              <SelectTrigger class="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="api">API</SelectItem>
              </SelectContent>
            </Select>

            <Select v-model="filter">
              <SelectTrigger class="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{{ t('mcpInstallations.details.logs.filter.all') }}</SelectItem>
                <SelectItem value="info">{{ t('mcpInstallations.details.logs.filter.info') }}</SelectItem>
                <SelectItem value="warn">{{ t('mcpInstallations.details.logs.filter.warn') }}</SelectItem>
                <SelectItem value="error">{{ t('mcpInstallations.details.logs.filter.error') }}</SelectItem>
                <SelectItem value="debug">{{ t('mcpInstallations.details.logs.filter.debug') }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <!-- Logs Table -->
        <LogsTable
          :logs="filteredLogs"
          :is-loading="isLoading"
        />
      </Card>
    </div>
  </div>
</template>
