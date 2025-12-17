<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { useRequestsStream } from '@/composables/mcp-server/installation'
import { McpRequestLogsService } from '@/services/mcpRequestLogsService'
import { RequestDetailSheet } from '@/components/mcp-server/installation'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Card } from '@/components/ui/card'
import { AlertCircle, AlertTriangle, Eye, Radio } from 'lucide-vue-next'
import type { McpInstallation } from '@/types/mcp-installations'
import type { McpRequestLog } from '@/types/mcp-request-logs'

interface Props {
  installation: McpInstallation
  teamId: string
}

const props = defineProps<Props>()
const { t } = useI18n()

const { requests, isConnected, isLoading, error, connect, disconnect } = useRequestsStream()

type FilterType = 'all' | 'success' | 'failed'
type ViewMode = 'live' | 'api'
const filter = ref<FilterType>('all')
const viewMode = ref<ViewMode>('live')
const selectedRequest = ref<McpRequestLog | null>(null)
const showDetailSheet = ref(false)

// Filtered requests based on filter selection
const filteredRequests = computed(() => {
  if (filter.value === 'all') return requests.value
  if (filter.value === 'success') return requests.value.filter(r => r.success)
  if (filter.value === 'failed') return requests.value.filter(r => !r.success)
  return requests.value
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

// Open detail sheet
function openDetail(request: McpRequestLog) {
  selectedRequest.value = request
  showDetailSheet.value = true
}

// Connect to SSE stream
function connectStream() {
  const options: { success?: boolean } = {}
  // Note: We filter client-side for better UX, so we don't pass success filter to stream
  const url = McpRequestLogsService.getStreamUrl(props.teamId, props.installation.id, options)
  connect(url)
}

// Reconnect when filter changes (we filter client-side, but could optimize server-side)
watch(filter, () => {
  // Client-side filtering, no need to reconnect
})

// Watch for view mode changes and show toast
watch(viewMode, (newMode, oldMode) => {
  if (!oldMode) return // Skip initial mount

  if (newMode === 'live') {
    connectStream()
    toast.success(t('mcpInstallations.details.requests.viewMode.switchedToLive'), {
      description: t('mcpInstallations.details.requests.viewMode.liveDescription')
    })
  } else if (newMode === 'api') {
    disconnect()
    toast(t('mcpInstallations.details.requests.viewMode.switchedToApi'), {
      description: t('mcpInstallations.details.requests.viewMode.apiDescription')
    })
  }
})

onMounted(() => {
  connectStream()
})

onUnmounted(() => {
  disconnect()
})
</script>

<template>
  <div>
    <!-- Error State (outside card) -->
    <Alert v-if="error" variant="destructive" class="mb-6">
      <AlertCircle class="h-4 w-4" />
      <AlertDescription>
        {{ t('mcpInstallations.details.requests.error.description', { error }) }}
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
            <span v-if="isConnected">{{ t('mcpInstallations.details.requests.connection.live') }}</span>
            <span v-else-if="isLoading">{{ t('mcpInstallations.details.requests.connection.reconnecting') }}</span>
            <span v-else>{{ t('mcpInstallations.details.requests.connection.disconnected') }}</span>
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
              <SelectItem value="all">{{ t('mcpInstallations.details.requests.filter.all') }}</SelectItem>
              <SelectItem value="success">{{ t('mcpInstallations.details.requests.filter.success') }}</SelectItem>
              <SelectItem value="failed">{{ t('mcpInstallations.details.requests.filter.failed') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="filteredRequests.length === 0" class="text-center py-12 px-6">
        <p class="text-sm">{{ t('mcpInstallations.details.requests.emptyState.title') }}</p>
        <p class="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          {{ t('mcpInstallations.details.requests.emptyState.description') }}
        </p>
      </div>

      <!-- Requests Table -->
      <div v-else>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-10"></TableHead>
            <TableHead class="w-40">{{ t('mcpInstallations.details.requests.table.columns.time') }}</TableHead>
            <TableHead>{{ t('mcpInstallations.details.requests.table.columns.tool') }}</TableHead>
            <TableHead>{{ t('mcpInstallations.details.requests.table.columns.user') }}</TableHead>
            <TableHead class="w-24 text-right">{{ t('mcpInstallations.details.requests.table.columns.duration') }}</TableHead>
            <TableHead class="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="request in filteredRequests"
            :key="request.id"
            class="cursor-pointer"
            @click="openDetail(request)"
          >
            <TableCell class="w-10 pr-0">
              <AlertTriangle
                v-if="!request.success"
                class="h-4 w-4 text-amber-500"
                :title="request.error_message || 'Failed'"
              />
              <span
                v-else
                class="text-xs font-medium text-green-600 dark:text-green-500"
              >
                OK
              </span>
            </TableCell>
            <TableCell class="text-sm text-muted-foreground font-mono tabular-nums">
              <HoverCard>
                <HoverCardTrigger class="cursor-pointer">
                  {{ formatTimestamp(request.created_at) }}
                </HoverCardTrigger>
                <HoverCardContent align="start" class="w-auto">
                  <table class="text-sm">
                    <tbody>
                      <tr>
                        <td class="text-muted-foreground pr-4 py-0.5">{{ getUserTimezone() }}</td>
                        <td class="font-mono tabular-nums text-right py-0.5">{{ formatLocalTimestamp(request.created_at) }}</td>
                      </tr>
                      <tr>
                        <td class="text-muted-foreground pr-4 py-0.5">UTC</td>
                        <td class="font-mono tabular-nums text-right py-0.5">{{ formatUtcTimestamp(request.created_at) }}</td>
                      </tr>
                      <tr>
                        <td class="text-muted-foreground pr-4 py-0.5">Relative</td>
                        <td class="text-right py-0.5">{{ formatRelativeTime(request.created_at) }}</td>
                      </tr>
                      <tr>
                        <td class="text-muted-foreground pr-4 py-0.5">Timestamp</td>
                        <td class="font-mono tabular-nums text-right py-0.5">{{ getUnixTimestamp(request.created_at) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </HoverCardContent>
              </HoverCard>
            </TableCell>
            <TableCell class="font-mono text-sm">
              {{ request.tool_name }}
            </TableCell>
            <TableCell class="text-sm">
              <span v-if="request.user">{{ request.user.user_name }}</span>
              <span v-else class="text-muted-foreground italic">Unknown</span>
            </TableCell>
            <TableCell class="text-sm text-right tabular-nums">
              {{ request.response_time_ms }}ms
            </TableCell>
            <TableCell class="w-12">
              <Eye class="h-4 w-4 text-muted-foreground" />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      </div>
    </Card>

    <!-- Detail Sheet -->
    <RequestDetailSheet
      :request="selectedRequest"
      :open="showDetailSheet"
      :team-id="teamId"
      :installation-id="installation.id"
      @update:open="showDetailSheet = $event"
    />
  </div>
</template>
