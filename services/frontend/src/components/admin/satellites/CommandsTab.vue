<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { SatelliteService, type SatelliteCommand, type Satellite } from '@/services/satelliteService'
import { CommandDetailSheet, CommandStatusBadge } from '@/components/admin/satellites'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Card } from '@/components/ui/card'
import PaginationControls from '@/components/ui/pagination/PaginationControls.vue'
import { AlertCircle, AlertTriangle, Eye, CheckCircle2, Clock, Loader2 } from 'lucide-vue-next'

interface Props {
  satellite: Satellite
}

const props = defineProps<Props>()
const { t } = useI18n()

const commands = ref<SatelliteCommand[]>([])
const currentPage = ref(1)
const pageSize = ref(20)
const totalItems = ref(0)
const isLoading = ref(false)
const error = ref<string | null>(null)
const selectedCommand = ref<SatelliteCommand | null>(null)
const showDetailSheet = ref(false)

// Load commands
async function loadCommands() {
  isLoading.value = true
  error.value = null

  try {
    const offset = (currentPage.value - 1) * pageSize.value
    const response = await SatelliteService.listCommands(props.satellite.id, {
      limit: pageSize.value,
      offset
    })

    commands.value = response.data.commands
    totalItems.value = response.data.pagination.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load commands'
  } finally {
    isLoading.value = false
  }
}

// Pagination handlers
async function handlePageChange(page: number) {
  currentPage.value = page
  await loadCommands()
}

async function handlePageSizeChange(newPageSize: number) {
  pageSize.value = newPageSize
  currentPage.value = 1
  await loadCommands()
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
function openDetail(command: SatelliteCommand) {
  selectedCommand.value = command
  showDetailSheet.value = true
}

// Get status icon
function getStatusIcon(status: SatelliteCommand['status']) {
  switch (status) {
    case 'completed':
      return CheckCircle2
    case 'failed':
      return AlertTriangle
    case 'executing':
      return Loader2
    default:
      return Clock
  }
}

onMounted(() => {
  loadCommands()
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
        <div class="text-sm font-medium">
          {{ t('satellites.commands.title') }}
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-center py-12 px-6">
        <Loader2 class="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p class="mt-4 text-sm text-muted-foreground">{{ t('satellites.commands.loading') }}</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="commands.length === 0" class="text-center py-12 px-6">
        <p class="text-sm">{{ t('satellites.commands.emptyState.title') }}</p>
        <p class="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          {{ t('satellites.commands.emptyState.description') }}
        </p>
      </div>

      <!-- Commands Table -->
      <div v-else>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-10"></TableHead>
              <TableHead class="w-40">{{ t('satellites.commands.table.columns.time') }}</TableHead>
              <TableHead>{{ t('satellites.commands.table.columns.type') }}</TableHead>
              <TableHead>{{ t('satellites.commands.table.columns.priority') }}</TableHead>
              <TableHead>{{ t('satellites.commands.table.columns.status') }}</TableHead>
              <TableHead class="w-20 text-right">{{ t('satellites.commands.table.columns.retries') }}</TableHead>
              <TableHead class="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="command in commands"
              :key="command.id"
              class="cursor-pointer hover:bg-muted/50"
              @click="openDetail(command)"
            >
              <TableCell class="w-10 pr-0">
                <component
                  :is="getStatusIcon(command.status)"
                  class="h-4 w-4"
                  :class="{
                    'text-green-600': command.status === 'completed',
                    'text-amber-500': command.status === 'failed',
                    'text-blue-600 animate-spin': command.status === 'executing',
                    'text-muted-foreground': command.status === 'pending' || command.status === 'acknowledged'
                  }"
                />
              </TableCell>
              <TableCell class="text-sm text-muted-foreground font-mono tabular-nums">
                <HoverCard>
                  <HoverCardTrigger class="cursor-pointer">
                    {{ formatTimestamp(command.created_at) }}
                  </HoverCardTrigger>
                  <HoverCardContent align="start" class="w-auto">
                    <table class="text-sm">
                      <tbody>
                        <tr>
                          <td class="text-muted-foreground pr-4 py-0.5">{{ getUserTimezone() }}</td>
                          <td class="font-mono tabular-nums text-right py-0.5">{{ formatLocalTimestamp(command.created_at) }}</td>
                        </tr>
                        <tr>
                          <td class="text-muted-foreground pr-4 py-0.5">UTC</td>
                          <td class="font-mono tabular-nums text-right py-0.5">{{ formatUtcTimestamp(command.created_at) }}</td>
                        </tr>
                        <tr>
                          <td class="text-muted-foreground pr-4 py-0.5">Relative</td>
                          <td class="text-right py-0.5">{{ formatRelativeTime(command.created_at) }}</td>
                        </tr>
                        <tr>
                          <td class="text-muted-foreground pr-4 py-0.5">Timestamp</td>
                          <td class="font-mono tabular-nums text-right py-0.5">{{ getUnixTimestamp(command.created_at) }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </HoverCardContent>
                </HoverCard>
              </TableCell>
              <TableCell class="font-mono text-sm">
                <Badge variant="outline">{{ command.command_type }}</Badge>
              </TableCell>
              <TableCell class="text-sm">
                <Badge
                  :variant="command.priority === 'immediate' || command.priority === 'high' ? 'default' : 'secondary'"
                  :class="{
                    'bg-red-600': command.priority === 'immediate',
                    'bg-orange-600': command.priority === 'high'
                  }"
                >
                  {{ command.priority }}
                </Badge>
              </TableCell>
              <TableCell class="text-sm">
                <CommandStatusBadge :status="command.status" />
              </TableCell>
              <TableCell class="text-sm text-right tabular-nums">
                {{ command.retry_count }}/{{ command.max_retries }}
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
    <CommandDetailSheet
      :command="selectedCommand"
      :open="showDetailSheet"
      @update:open="showDetailSheet = $event"
    />
  </div>
</template>
