<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { useLogsStream } from '@/composables/mcp-server/installation'
import { McpLogsService } from '@/services/mcpLogsService'
import { LogsNoAccess } from '@/components/mcp-server/installation'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Card } from '@/components/ui/card'
import { AlertCircle, Radio } from 'lucide-vue-next'
import type { McpInstallation } from '@/types/mcp-installations'
import type { McpLog } from '@/types/mcp-logs'

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

// Format timestamp in Vercel style: "Dec 17 09:27:37.30"
function formatTimestamp(dateString: string): string {
  const date = new Date(dateString)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = months[date.getMonth()]
  const day = date.getDate().toString().padStart(2, '0')
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  const ms = Math.floor(date.getMilliseconds() / 10).toString().padStart(2, '0')
  return `${month} ${day} ${hours}:${minutes}:${seconds}.${ms}`
}

// Format local timezone timestamp
function formatLocalTimestamp(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  } as Intl.DateTimeFormatOptions)
}

// Format UTC timestamp
function formatUtcTimestamp(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    timeZone: 'UTC'
  } as Intl.DateTimeFormatOptions)
}

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return `${diffSecs} seconds ago`
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
}

// Get Unix timestamp in milliseconds
function getUnixTimestamp(dateString: string): number {
  return new Date(dateString).getTime()
}

// Get user's timezone name
function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

// Get text color class based on log level
function getLevelTextClass(level: McpLog['level']): string {
  switch (level) {
    case 'error':
      return 'text-red-600 dark:text-red-500'
    case 'warn':
      return 'text-amber-600 dark:text-amber-500'
    case 'debug':
      return 'text-neutral-500 dark:text-neutral-400'
    case 'info':
    default:
      return 'text-green-600 dark:text-green-500'
  }
}

// Connect to SSE stream
function connectStream() {
  const options: { level?: FilterType; limit?: number } = {}
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

        <!-- Empty State -->
        <div v-if="filteredLogs.length === 0" class="text-center py-12 px-6">
          <p class="text-sm">{{ t('mcpInstallations.details.logs.emptyState.title') }}</p>
          <p class="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            {{ t('mcpInstallations.details.logs.emptyState.description') }}
          </p>
        </div>

        <!-- Logs Table -->
        <div v-else>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-24">{{ t('mcpInstallations.details.logs.table.columns.level') }}</TableHead>
                <TableHead class="w-40">{{ t('mcpInstallations.details.logs.table.columns.time') }}</TableHead>
                <TableHead>{{ t('mcpInstallations.details.logs.table.columns.message') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="log in filteredLogs"
                :key="log.id"
              >
                <TableCell class="w-24">
                  <span class="text-xs font-medium" :class="getLevelTextClass(log.level)">
                    {{ log.level.toUpperCase() }}
                  </span>
                </TableCell>
                <TableCell class="text-sm text-muted-foreground font-mono tabular-nums">
                  <HoverCard>
                    <HoverCardTrigger class="cursor-pointer">
                      {{ formatTimestamp(log.created_at) }}
                    </HoverCardTrigger>
                    <HoverCardContent align="start" class="w-auto">
                      <table class="text-sm">
                        <tbody>
                          <tr>
                            <td class="text-muted-foreground pr-4 py-0.5">{{ getUserTimezone() }}</td>
                            <td class="font-mono tabular-nums text-right py-0.5">{{ formatLocalTimestamp(log.created_at) }}</td>
                          </tr>
                          <tr>
                            <td class="text-muted-foreground pr-4 py-0.5">UTC</td>
                            <td class="font-mono tabular-nums text-right py-0.5">{{ formatUtcTimestamp(log.created_at) }}</td>
                          </tr>
                          <tr>
                            <td class="text-muted-foreground pr-4 py-0.5">Relative</td>
                            <td class="text-right py-0.5">{{ formatRelativeTime(log.created_at) }}</td>
                          </tr>
                          <tr>
                            <td class="text-muted-foreground pr-4 py-0.5">Timestamp</td>
                            <td class="font-mono tabular-nums text-right py-0.5">{{ getUnixTimestamp(log.created_at) }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </HoverCardContent>
                  </HoverCard>
                </TableCell>
                <TableCell class="text-sm">
                  {{ log.message }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  </div>
</template>
