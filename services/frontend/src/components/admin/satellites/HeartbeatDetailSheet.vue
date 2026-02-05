<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SatelliteHeartbeat, SystemMetrics } from '@/services/satelliteService'
import { HeartbeatStatusBadge } from '@/components/admin/satellites'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Activity, Cpu, HardDrive, Network } from 'lucide-vue-next'

interface Props {
  heartbeat: SatelliteHeartbeat | null
  open: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { t } = useI18n()

// Parse system metrics
const parsedMetrics = computed<SystemMetrics | null>(() => {
  if (!props.heartbeat?.system_metrics) return null
  try {
    const parsed = JSON.parse(props.heartbeat.system_metrics)
    return {
      cpu: parsed.cpu ?? 0,
      memory: parsed.memory ?? 0,
      disk: parsed.disk ?? 0,
      network: parsed.network
    }
  } catch {
    return null
  }
})

// Format timestamp
function formatTimestamp(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Format uptime
function formatDetailedUptime(seconds: number | null): string {
  if (seconds === null) return 'N/A'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const parts = []
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`)
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`)
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`)
  if (secs > 0 || parts.length === 0) parts.push(`${secs} second${secs !== 1 ? 's' : ''}`)

  return parts.join(', ')
}

// Format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent class="overflow-y-auto sm:max-w-2xl">
      <SheetHeader v-if="heartbeat">
        <SheetTitle class="flex items-center gap-2">
          <Activity class="h-5 w-5 text-green-600" />
          {{ t('satellites.heartbeats.detail.title') }}
        </SheetTitle>
        <SheetDescription>
          {{ t('satellites.heartbeats.detail.description') }}
        </SheetDescription>
      </SheetHeader>

      <div v-if="heartbeat" class="space-y-6 py-6">
        <!-- Heartbeat ID -->
        <div>
          <div class="text-sm font-medium text-muted-foreground mb-1">
            {{ t('satellites.heartbeats.detail.heartbeatId') }}
          </div>
          <div class="text-sm font-mono bg-muted p-2 rounded-md">
            {{ heartbeat.id }}
          </div>
        </div>

        <!-- Status and Timestamp -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <div class="text-sm font-medium text-muted-foreground mb-1">
              {{ t('satellites.heartbeats.detail.status') }}
            </div>
            <HeartbeatStatusBadge :status="heartbeat.status" />
          </div>
          <div>
            <div class="text-sm font-medium text-muted-foreground mb-1">
              {{ t('satellites.heartbeats.detail.timestamp') }}
            </div>
            <div class="text-sm">{{ formatTimestamp(heartbeat.timestamp) }}</div>
          </div>
        </div>

        <Separator />

        <!-- Process Information -->
        <div>
          <div class="text-sm font-medium mb-3 flex items-center gap-2">
            <Activity class="h-4 w-4" />
            {{ t('satellites.heartbeats.detail.processes') }}
          </div>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <div class="text-sm text-muted-foreground mb-1">{{ t('satellites.heartbeats.detail.total') }}</div>
              <div class="text-2xl font-semibold">{{ heartbeat.process_count }}</div>
            </div>
            <div>
              <div class="text-sm text-muted-foreground mb-1">{{ t('satellites.heartbeats.detail.healthy') }}</div>
              <div class="text-2xl font-semibold text-green-600">{{ heartbeat.healthy_process_count }}</div>
            </div>
            <div>
              <div class="text-sm text-muted-foreground mb-1">{{ t('satellites.heartbeats.detail.errors') }}</div>
              <div class="text-2xl font-semibold" :class="heartbeat.error_count > 0 ? 'text-red-600' : ''">
                {{ heartbeat.error_count }}
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <!-- System Metrics -->
        <div v-if="parsedMetrics">
          <div class="text-sm font-medium mb-3 flex items-center gap-2">
            <Cpu class="h-4 w-4" />
            {{ t('satellites.heartbeats.detail.systemMetrics') }}
          </div>
          <div class="space-y-3">
            <!-- CPU -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm text-muted-foreground">CPU</span>
                <span class="text-sm font-medium">{{ (parsedMetrics.cpu ?? 0).toFixed(1) }}%</span>
              </div>
              <div class="w-full bg-muted rounded-full h-2">
                <div
                  class="h-2 rounded-full transition-all"
                  :class="{
                    'bg-green-600': (parsedMetrics.cpu ?? 0) < 70,
                    'bg-yellow-600': (parsedMetrics.cpu ?? 0) >= 70 && (parsedMetrics.cpu ?? 0) < 90,
                    'bg-red-600': (parsedMetrics.cpu ?? 0) >= 90
                  }"
                  :style="{ width: `${Math.min(parsedMetrics.cpu ?? 0, 100)}%` }"
                ></div>
              </div>
            </div>

            <!-- Memory -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm text-muted-foreground flex items-center gap-1">
                  <HardDrive class="h-3 w-3" />
                  Memory
                </span>
                <span class="text-sm font-medium">{{ (parsedMetrics.memory ?? 0).toFixed(1) }}%</span>
              </div>
              <div class="w-full bg-muted rounded-full h-2">
                <div
                  class="h-2 rounded-full transition-all"
                  :class="{
                    'bg-green-600': (parsedMetrics.memory ?? 0) < 70,
                    'bg-yellow-600': (parsedMetrics.memory ?? 0) >= 70 && (parsedMetrics.memory ?? 0) < 90,
                    'bg-red-600': (parsedMetrics.memory ?? 0) >= 90
                  }"
                  :style="{ width: `${Math.min(parsedMetrics.memory ?? 0, 100)}%` }"
                ></div>
              </div>
            </div>

            <!-- Disk -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm text-muted-foreground">Disk</span>
                <span class="text-sm font-medium">{{ (parsedMetrics.disk ?? 0).toFixed(1) }}%</span>
              </div>
              <div class="w-full bg-muted rounded-full h-2">
                <div
                  class="h-2 rounded-full transition-all"
                  :class="{
                    'bg-green-600': (parsedMetrics.disk ?? 0) < 70,
                    'bg-yellow-600': (parsedMetrics.disk ?? 0) >= 70 && (parsedMetrics.disk ?? 0) < 90,
                    'bg-red-600': (parsedMetrics.disk ?? 0) >= 90
                  }"
                  :style="{ width: `${Math.min(parsedMetrics.disk ?? 0, 100)}%` }"
                ></div>
              </div>
            </div>

            <!-- Network -->
            <div v-if="parsedMetrics.network" class="pt-2">
              <div class="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                <Network class="h-3 w-3" />
                Network
              </div>
              <div class="grid grid-cols-2 gap-4 bg-muted p-3 rounded-md">
                <div>
                  <div class="text-xs text-muted-foreground mb-1">Received</div>
                  <div class="text-sm font-mono">{{ formatBytes(parsedMetrics.network.rx) }}</div>
                </div>
                <div>
                  <div class="text-xs text-muted-foreground mb-1">Transmitted</div>
                  <div class="text-sm font-mono">{{ formatBytes(parsedMetrics.network.tx) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <!-- Performance Metrics -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <div class="text-sm font-medium text-muted-foreground mb-1">
              {{ t('satellites.heartbeats.detail.responseTime') }}
            </div>
            <div class="text-sm">
              <span v-if="heartbeat.response_time_ms" class="font-mono">{{ heartbeat.response_time_ms }}ms</span>
              <span v-else class="text-muted-foreground">N/A</span>
            </div>
          </div>
          <div>
            <div class="text-sm font-medium text-muted-foreground mb-1">
              {{ t('satellites.heartbeats.detail.uptime') }}
            </div>
            <div class="text-sm">{{ formatDetailedUptime(heartbeat.uptime_seconds) }}</div>
          </div>
        </div>

        <!-- Version -->
        <div v-if="heartbeat.version">
          <div class="text-sm font-medium text-muted-foreground mb-1">
            {{ t('satellites.heartbeats.detail.version') }}
          </div>
          <div class="text-sm font-mono">{{ heartbeat.version }}</div>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
