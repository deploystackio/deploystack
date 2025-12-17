<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRequestsStream } from '@/composables/mcp-server/installation'
import { McpRequestLogsService } from '@/services/mcpRequestLogsService'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { AlertCircle, AlertTriangle, Eye, Radio, Copy, Check } from 'lucide-vue-next'
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
const filter = ref<FilterType>('all')
const selectedRequest = ref<McpRequestLog | null>(null)
const showDetailDialog = ref(false)
const copiedField = ref<string | null>(null)

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
  })
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
  })
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

// Format JSON for display
function formatJson(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

// Copy to clipboard
async function copyToClipboard(value: unknown, field: string) {
  try {
    await navigator.clipboard.writeText(formatJson(value))
    copiedField.value = field
    setTimeout(() => {
      copiedField.value = null
    }, 2000)
  } catch {
    console.error('Failed to copy to clipboard')
  }
}

// Open detail dialog
function openDetail(request: McpRequestLog) {
  selectedRequest.value = request
  showDetailDialog.value = true
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

onMounted(() => {
  connectStream()
})

onUnmounted(() => {
  disconnect()
})
</script>

<template>
  <div>
    <!-- Header with connection status and filter -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <div
          class="flex items-center gap-1.5 text-sm"
          :class="isConnected ? 'text-green-600' : 'text-muted-foreground'"
        >
          <Radio class="h-3 w-3" :class="{ 'animate-pulse': isConnected }" />
          <span v-if="isConnected">{{ t('mcpInstallations.details.requests.connection.live') }}</span>
          <span v-else-if="isLoading">{{ t('mcpInstallations.details.requests.connection.reconnecting') }}</span>
          <span v-else>{{ t('mcpInstallations.details.requests.connection.disconnected') }}</span>
        </div>
      </div>

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

    <!-- Loading State -->
    <div v-if="isLoading && requests.length === 0" class="text-muted-foreground py-8 text-center">
      {{ t('mcpInstallations.details.requests.loading') }}
    </div>

    <!-- Error State -->
    <Alert v-else-if="error" variant="destructive" class="mb-6">
      <AlertCircle class="h-4 w-4" />
      <AlertDescription>
        {{ t('mcpInstallations.details.requests.error.description', { error }) }}
      </AlertDescription>
    </Alert>

    <!-- Empty State -->
    <div v-else-if="filteredRequests.length === 0" class="text-center py-12">
      <AlertCircle class="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-semibold">{{ t('mcpInstallations.details.requests.emptyState.title') }}</h3>
      <p class="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        {{ t('mcpInstallations.details.requests.emptyState.description') }}
      </p>
    </div>

    <!-- Requests Table -->
    <div v-else class="rounded-md border">
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
          <TableRow v-for="request in filteredRequests" :key="request.id">
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
              <Button variant="ghost" size="sm" @click="openDetail(request)">
                <Eye class="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Detail Dialog -->
    <Dialog v-model:open="showDetailDialog">
      <DialogContent class="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{{ t('mcpInstallations.details.requests.detail.title') }}</DialogTitle>
          <DialogDescription>
            {{ selectedRequest?.tool_name }}
          </DialogDescription>
        </DialogHeader>

        <div v-if="selectedRequest" class="space-y-4 mt-4">
          <!-- Status and Timing -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="text-sm font-medium text-muted-foreground mb-1">
                {{ t('mcpInstallations.details.requests.detail.status') }}
              </div>
              <div class="flex items-center gap-2 text-sm">
                <AlertTriangle v-if="!selectedRequest.success" class="h-4 w-4 text-amber-500" />
                <span>{{ selectedRequest.success ? t('mcpInstallations.details.requests.table.values.success') : t('mcpInstallations.details.requests.table.values.failed') }}</span>
              </div>
            </div>
            <div>
              <div class="text-sm font-medium text-muted-foreground mb-1">
                {{ t('mcpInstallations.details.requests.detail.responseTime') }}
              </div>
              <div class="text-sm tabular-nums">{{ selectedRequest.response_time_ms }}ms</div>
            </div>
          </div>

          <!-- User and Timestamp -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="text-sm font-medium text-muted-foreground mb-1">
                {{ t('mcpInstallations.details.requests.detail.user') }}
              </div>
              <div class="text-sm">
                <div v-if="selectedRequest.user">{{ selectedRequest.user.user_name }}</div>
                <div v-else class="text-muted-foreground italic">Unknown</div>
              </div>
            </div>
            <div>
              <div class="text-sm font-medium text-muted-foreground mb-1">
                {{ t('mcpInstallations.details.requests.detail.timestamp') }}
              </div>
              <div class="text-sm font-mono tabular-nums">{{ formatLocalTimestamp(selectedRequest.created_at) }}</div>
            </div>
          </div>

          <!-- Error Message (if failed) -->
          <div v-if="!selectedRequest.success && selectedRequest.error_message">
            <div class="text-sm font-medium text-muted-foreground mb-1">
              {{ t('mcpInstallations.details.requests.detail.error') }}
            </div>
            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 text-sm text-red-800 dark:text-red-300">
              {{ selectedRequest.error_message }}
            </div>
          </div>

          <!-- Parameters -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <div class="text-sm font-medium text-muted-foreground">
                {{ t('mcpInstallations.details.requests.detail.parameters') }}
              </div>
              <Button variant="ghost" size="sm" @click="copyToClipboard(selectedRequest.tool_params, 'params')">
                <Check v-if="copiedField === 'params'" class="h-3 w-3" />
                <Copy v-else class="h-3 w-3" />
              </Button>
            </div>
            <pre class="bg-muted rounded-md p-3 text-sm overflow-x-auto max-h-48">{{ formatJson(selectedRequest.tool_params) }}</pre>
          </div>

          <!-- Response -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <div class="text-sm font-medium text-muted-foreground">
                {{ t('mcpInstallations.details.requests.detail.response') }}
              </div>
              <Button variant="ghost" size="sm" @click="copyToClipboard(selectedRequest.tool_response, 'response')">
                <Check v-if="copiedField === 'response'" class="h-3 w-3" />
                <Copy v-else class="h-3 w-3" />
              </Button>
            </div>
            <pre class="bg-muted rounded-md p-3 text-sm overflow-x-auto max-h-64">{{ formatJson(selectedRequest.tool_response) }}</pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
