<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useEventBus } from '@/composables/useEventBus'
import { useSSE } from '@/composables/useSSE'
import { LineChart } from '@/components/ui/chart'
import { McpClientActivityMetricsService } from '@/services/mcpClientActivityMetricsService'
import type { McpClientActivityMetricsResponse } from '@/services/mcpClientActivityMetricsService'

const eventBus = useEventBus()

const {
  data: metricsData,
  isLoading,
  error,
  connect,
  disconnect
} = useSSE<McpClientActivityMetricsResponse['data']>('mcp_metrics')

function formatTimeLabel(timestamp: string): string {
  const date = new Date(timestamp)
  const hour = date.getHours().toString().padStart(2, '0')
  const minute = date.getMinutes().toString().padStart(2, '0')
  return `${hour}:${minute}`
}

const requestData = computed(() =>
  metricsData.value?.buckets.map(bucket => bucket.request_count) ?? []
)

const timeLabels = computed(() =>
  metricsData.value?.buckets.map(bucket => formatTimeLabel(bucket.timestamp)) ?? []
)

const totalRequests = computed(() =>
  requestData.value.reduce((sum, val) => sum + val, 0)
)

const averageRequests = computed(() =>
  requestData.value.length > 0
    ? Math.round(totalRequests.value / requestData.value.length)
    : 0
)

const peakRequests = computed(() =>
  requestData.value.length > 0
    ? Math.max(...requestData.value)
    : 0
)

function connectToTeam(teamId: string) {
  const url = McpClientActivityMetricsService.getStreamUrl({
    team_id: teamId,
    time_range: '3h',
    interval: '15m'
  })
  connect(url)
}

function handleTeamChange() {
  const teamId = eventBus.getState<string>('selected_team_id')

  if (teamId) {
    connectToTeam(teamId)
  } else {
    disconnect()
  }
}

onMounted(() => {
  const teamId = eventBus.getState<string>('selected_team_id')

  if (teamId) {
    connectToTeam(teamId)
  }

  eventBus.on('team-selected', handleTeamChange)
})

onUnmounted(() => {
  eventBus.off('team-selected', handleTeamChange)
  disconnect()
})
</script>

<template>
  <div class="space-y-4">
    <div>
      <h3 class="text-lg font-semibold">MCP Server Usage</h3>
    </div>

    <div v-if="error" class="text-center py-8">
      <p class="text-sm text-destructive mb-2">{{ error }}</p>
      <button
        @click="handleTeamChange"
        class="text-sm text-primary hover:underline"
      >
        Retry
      </button>
    </div>

    <div v-else class="grid grid-cols-1 gap-4 lg:grid-cols-[75%_1fr]">
      <LineChart
        :data="requestData"
        :labels="timeLabels"
        name="MCP Requests"
        size="sm"
        :loading="isLoading"
        color="#0f766e"
        area-color="rgba(15, 118, 110, 0.3)"
      />

      <div class="flex flex-col justify-between h-[200px]">
        <div class="space-y-1">
          <p class="text-sm text-muted-foreground">Total Requests</p>
          <p class="text-xl font-semibold">{{ totalRequests }}</p>
        </div>
        <div class="space-y-1">
          <p class="text-sm text-muted-foreground">Average per Interval</p>
          <p class="text-xl font-semibold">{{ averageRequests }}</p>
        </div>
        <div class="space-y-1">
          <p class="text-sm text-muted-foreground">Peak Requests</p>
          <p class="text-xl font-semibold">{{ peakRequests }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
