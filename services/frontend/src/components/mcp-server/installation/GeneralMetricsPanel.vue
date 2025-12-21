<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { LineChart } from '@/components/ui/chart'
import { getEnv } from '@/utils/env'

interface Props {
  teamId: string
  installationId: string
  toolCount: number
}

const props = defineProps<Props>()

// Requests data for graph
const requestsData = ref<number[]>([])
const requestsLabels = ref<string[]>([])
const isLoadingRequests = ref(true)
const totalRequests = ref(0)

// Fetch requests from API
async function fetchRequests() {
  isLoadingRequests.value = true
  try {
    const baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')
    const url = `${baseUrl}/api/teams/${props.teamId}/mcp/installations/${props.installationId}/requests?limit=40`

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch requests: ${response.status}`)
    }

    const result = await response.json()
    const requests = result.data?.requests || []

    // Store total count
    totalRequests.value = requests.length

    // Group requests by minute for the graph
    const timeMap = new Map<string, number>()

    requests.forEach((req: { created_at: string }) => {
      const date = new Date(req.created_at)
      const timeKey = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
      timeMap.set(timeKey, (timeMap.get(timeKey) || 0) + 1)
    })

    // Sort by time and create arrays for chart
    const sortedEntries = Array.from(timeMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    requestsLabels.value = sortedEntries.map(([time]) => time)
    requestsData.value = sortedEntries.map(([, count]) => count)

  } catch (error) {
    console.error('Failed to fetch requests:', error)
    requestsData.value = []
    requestsLabels.value = []
  } finally {
    isLoadingRequests.value = false
  }
}

onMounted(() => {
  fetchRequests()
})
</script>

<template>
  <div class="border rounded-lg p-6">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-8">
      <!-- Total Requests Metric -->
      <div class="flex flex-col gap-1">
        <span class="text-sm text-muted-foreground font-medium">
          Total Requests
        </span>
        <div class="flex items-baseline gap-1">
          <span class="text-xl font-normal">
            {{ totalRequests }}
          </span>
        </div>
      </div>

      <!-- Requests Graph -->
      <div class="col-span-2 flex flex-col gap-1 border-l pl-8">
        <span class="text-sm text-muted-foreground font-medium">
          Requests
        </span>
        <div class="h-16 -mb-2">
          <LineChart
            v-if="!isLoadingRequests && requestsData.length > 0"
            :data="requestsData"
            :labels="requestsLabels"
            name="Requests"
            :show-symbol="false"
            :show-area="false"
            :show-axis="false"
            size="sm"
            color="#0f766e"
            class="h-16!"
          />
          <div v-else-if="isLoadingRequests" class="flex items-center justify-center h-full text-sm text-muted-foreground">
            Loading...
          </div>
          <div v-else class="flex items-center justify-center h-full text-sm text-muted-foreground">
            No requests
          </div>
        </div>
      </div>

      <!-- Tools Count Metric -->
      <div class="flex flex-col gap-1 border-l pl-8">
        <span class="text-sm text-muted-foreground font-medium">
          Tools
        </span>
        <div class="flex items-baseline gap-1">
          <span class="text-xl font-normal">
            {{ toolCount }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
