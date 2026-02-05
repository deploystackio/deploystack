<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { SatelliteService, type SatelliteHeartbeat, type SystemMetrics, type Satellite } from '@/services/satelliteService'
import { HeartbeatDetailSheet, HeartbeatStatusBadge } from '@/components/admin/satellites'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Card } from '@/components/ui/card'
import PaginationControls from '@/components/ui/pagination/PaginationControls.vue'
import { AlertCircle, Eye, Activity, Loader2 } from 'lucide-vue-next'

interface Props {
  satellite: Satellite
}

const props = defineProps<Props>()
const { t } = useI18n()

const heartbeats = ref<SatelliteHeartbeat[]>([])
const currentPage = ref(1)
const pageSize = ref(20)
const totalItems = ref(0)
const isLoading = ref(false)
const error = ref<string | null>(null)
const selectedHeartbeat = ref<SatelliteHeartbeat | null>(null)
const showDetailSheet = ref(false)

// Load heartbeats
async function loadHeartbeats() {
  isLoading.value = true
  error.value = null

  try {
    const offset = (currentPage.value - 1) * pageSize.value
    const response = await SatelliteService.listHeartbeats(props.satellite.id, {
      limit: pageSize.value,
      offset
    })

    heartbeats.value = response.data.heartbeats
    totalItems.value = response.data.pagination.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load heartbeats'
  } finally {
    isLoading.value = false
  }
}

// Pagination handlers
async function handlePageChange(page: number) {
  currentPage.value = page
  await loadHeartbeats()
}

async function handlePageSizeChange(newPageSize: number) {
  pageSize.value = newPageSize
  currentPage.value = 1
  await loadHeartbeats()
}

// Parse system metrics
function parseMetrics(metricsJson: string): SystemMetrics {
  try {
    const parsed = JSON.parse(metricsJson)
    return {
      cpu: parsed.cpu ?? 0,
      memory: parsed.memory ?? 0,
      disk: parsed.disk ?? 0,
      network: parsed.network
    }
  } catch {
    return { cpu: 0, memory: 0, disk: 0 }
  }
}

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
function openDetail(heartbeat: SatelliteHeartbeat) {
  selectedHeartbeat.value = heartbeat
  showDetailSheet.value = true
}

// Format uptime
function formatUptime(seconds: number | null): string {
  if (seconds === null) return 'N/A'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

onMounted(() => {
  loadHeartbeats()
})
</script>

<template>
  <div>
    <!-- Error State -->
    <Alert v-if="error" variant="destructive" class="mb-6">
      <AlertCircle class="h-4 w-4" />
      <AlertDescription>
        {{ error }}
      </AlertDescription>
    </Alert>

    <!-- Main Card -->
    <Card v-else class="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 p-0 gap-0">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
        <div class="text-sm font-medium flex items-center gap-2">
          <Activity class="h-4 w-4" />
          {{ t('satellites.heartbeats.title') }}
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-center py-12 px-6">
        <Loader2 class="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p class="mt-4 text-sm text-muted-foreground">{{ t('satellites.heartbeats.loading') }}</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="heartbeats.length === 0" class="text-center py-12 px-6">
        <Activity class="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <p class="text-sm">{{ t('satellites.heartbeats.emptyState.title') }}</p>
        <p class="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          {{ t('satellites.heartbeats.emptyState.description') }}
        </p>
      </div>

      <!-- Heartbeats Table -->
      <div v-else>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-40">{{ t('satellites.heartbeats.table.columns.time') }}</TableHead>
              <TableHead>{{ t('satellites.heartbeats.table.columns.status') }}</TableHead>
              <TableHead class="text-right">{{ t('satellites.heartbeats.table.columns.processes') }}</TableHead>
              <TableHead class="text-right">{{ t('satellites.heartbeats.table.columns.cpu') }}</TableHead>
              <TableHead class="text-right">{{ t('satellites.heartbeats.table.columns.memory') }}</TableHead>
              <TableHead class="text-right">{{ t('satellites.heartbeats.table.columns.responseTime') }}</TableHead>
              <TableHead class="text-right">{{ t('satellites.heartbeats.table.columns.uptime') }}</TableHead>
              <TableHead class="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="heartbeat in heartbeats"
              :key="heartbeat.id"
              class="cursor-pointer hover:bg-muted/50"
              @click="openDetail(heartbeat)"
            >
              <TableCell class="text-sm text-muted-foreground font-mono tabular-nums">
                <HoverCard>
                  <HoverCardTrigger class="cursor-pointer">
                    {{ formatTimestamp(heartbeat.timestamp) }}
                  </HoverCardTrigger>
                  <HoverCardContent align="start" class="w-auto">
                    <table class="text-sm">
                      <tbody>
                        <tr>
                          <td class="text-muted-foreground pr-4 py-0.5">{{ getUserTimezone() }}</td>
                          <td class="font-mono tabular-nums text-right py-0.5">{{ formatLocalTimestamp(heartbeat.timestamp) }}</td>
                        </tr>
                        <tr>
                          <td class="text-muted-foreground pr-4 py-0.5">UTC</td>
                          <td class="font-mono tabular-nums text-right py-0.5">{{ formatUtcTimestamp(heartbeat.timestamp) }}</td>
                        </tr>
                        <tr>
                          <td class="text-muted-foreground pr-4 py-0.5">Relative</td>
                          <td class="text-right py-0.5">{{ formatRelativeTime(heartbeat.timestamp) }}</td>
                        </tr>
                        <tr>
                          <td class="text-muted-foreground pr-4 py-0.5">Timestamp</td>
                          <td class="font-mono tabular-nums text-right py-0.5">{{ getUnixTimestamp(heartbeat.timestamp) }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </HoverCardContent>
                </HoverCard>
              </TableCell>
              <TableCell>
                <HeartbeatStatusBadge :status="heartbeat.status" />
              </TableCell>
              <TableCell class="text-sm text-right tabular-nums">
                <span :class="heartbeat.healthy_process_count < heartbeat.process_count ? 'text-amber-600' : ''">
                  {{ heartbeat.healthy_process_count }}/{{ heartbeat.process_count }}
                </span>
              </TableCell>
              <TableCell class="text-sm text-right tabular-nums">
                {{ (parseMetrics(heartbeat.system_metrics).cpu ?? 0).toFixed(1) }}%
              </TableCell>
              <TableCell class="text-sm text-right tabular-nums">
                {{ (parseMetrics(heartbeat.system_metrics).memory ?? 0).toFixed(1) }}%
              </TableCell>
              <TableCell class="text-sm text-right tabular-nums">
                <span v-if="heartbeat.response_time_ms">{{ heartbeat.response_time_ms }}ms</span>
                <span v-else class="text-muted-foreground">-</span>
              </TableCell>
              <TableCell class="text-sm text-right tabular-nums">
                {{ formatUptime(heartbeat.uptime_seconds) }}
              </TableCell>
              <TableCell class="w-12">
                <Eye class="h-4 w-4 text-muted-foreground" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>

    <!-- Pagination Controls (outside card) -->
    <PaginationControls
      v-if="totalItems > 0"
      :current-page="currentPage"
      :page-size="pageSize"
      :total-items="totalItems"
      :is-loading="isLoading"
      translation-prefix="satellites"
      @page-change="handlePageChange"
      @page-size-change="handlePageSizeChange"
    />

    <!-- Detail Sheet -->
    <HeartbeatDetailSheet
      :heartbeat="selectedHeartbeat"
      :open="showDetailSheet"
      @update:open="showDetailSheet = $event"
    />
  </div>
</template>
