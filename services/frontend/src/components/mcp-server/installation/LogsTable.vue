<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import type { McpLog } from '@/types/mcp-logs'
import { useI18n } from 'vue-i18n'

interface Props {
  logs: McpLog[]
  isLoading?: boolean
  emptyMessage?: string
  showHeader?: boolean
  maxHeight?: string
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  showHeader: true,
  maxHeight: '400px'
})

const scrollContainer = ref<HTMLElement | null>(null)

watch(() => props.logs, () => {
  nextTick(() => {
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
    }
  })
}, { deep: true })

const { t } = useI18n()

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
</script>

<template>
  <!-- Empty State -->
  <div v-if="logs.length === 0" class="text-center py-12 px-6">
    <p class="text-sm">{{ emptyMessage || t('mcpInstallations.details.logs.emptyState.title') }}</p>
    <p class="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
      {{ t('mcpInstallations.details.logs.emptyState.description') }}
    </p>
  </div>

  <!-- Logs Table -->
  <div v-else ref="scrollContainer" class="overflow-y-auto" :style="{ maxHeight: maxHeight }">
    <Table>
      <TableHeader v-if="showHeader">
        <TableRow>
          <TableHead class="w-24">{{ t('mcpInstallations.details.logs.table.columns.level') }}</TableHead>
          <TableHead class="w-40">{{ t('mcpInstallations.details.logs.table.columns.time') }}</TableHead>
          <TableHead>{{ t('mcpInstallations.details.logs.table.columns.message') }}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="log in logs"
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
</template>
