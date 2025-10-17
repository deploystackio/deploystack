<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useEventBus } from '@/composables/useEventBus'
import { LineChart } from '@/components/ui/chart'
import { McpClientActivityMetricsService } from '@/services/mcpClientActivityMetricsService'

const eventBus = useEventBus()

const isLoading = ref(true)
const error = ref<string | null>(null)
const requestData = ref<number[]>([])
const timeLabels = ref<string[]>([])

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

function formatTimeLabel(timestamp: string): string {
  const date = new Date(timestamp)
  const hour = date.getHours().toString().padStart(2, '0')
  const minute = date.getMinutes().toString().padStart(2, '0')
  return `${hour}:${minute}`
}

async function fetchMetrics() {
  const teamId = eventBus.getState<string>('selected_team_id')
  
  if (!teamId) {
    error.value = 'No team selected'
    console.warn('No team selected - cannot fetch metrics')
    isLoading.value = false
    return
  }
  
  try {
    isLoading.value = true
    error.value = null
    
    const response = await McpClientActivityMetricsService.getMetrics({
      team_id: teamId,
      time_range: '3h',
      interval: '15m'
    })
    
    requestData.value = response.data.buckets.map(bucket => bucket.request_count)
    timeLabels.value = response.data.buckets.map(bucket => formatTimeLabel(bucket.timestamp))
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to fetch metrics'
    console.error('Failed to fetch MCP metrics:', err)
    requestData.value = []
    timeLabels.value = []
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  await fetchMetrics()
  
  eventBus.on('team-selected', async () => {
    await fetchMetrics()
  })
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
        @click="fetchMetrics" 
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
