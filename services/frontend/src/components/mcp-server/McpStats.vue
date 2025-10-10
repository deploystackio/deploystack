<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { LineChart } from '@/components/ui/chart'

const isLoading = ref(true)
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

const generateDummyData = () => {
  const now = new Date()
  const data: number[] = []
  const labels: string[] = []

  for (let i = 11; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 5 * 60 * 1000)
    const hour = time.getHours().toString().padStart(2, '0')
    const minute = time.getMinutes().toString().padStart(2, '0')
    labels.push(`${hour}:${minute}`)
    
    const baseValue = 20 + Math.random() * 30
    const variation = Math.sin(i / 2) * 15
    data.push(Math.max(0, Math.round(baseValue + variation)))
  }

  return { data, labels }
}

onMounted(() => {
  setTimeout(() => {
    const { data, labels } = generateDummyData()
    requestData.value = data
    timeLabels.value = labels
    isLoading.value = false
  }, 500)
})
</script>

<template>
  <div class="space-y-4">
    <div>
      <h3 class="text-lg font-semibold">MCP Server Usage</h3>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-[75%_1fr]">
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
