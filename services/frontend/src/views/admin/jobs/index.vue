<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, Clock, Play, CheckCircle2, XCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { JobsService } from '@/services/jobsService'
import JobTableColumns from './JobTableColumns.vue'
import PaginationControls from '@/components/ui/pagination/PaginationControls.vue'
import type { Job, JobStats, JobFilters, JobStatus } from './types'

const jobs = ref<Job[]>([])
const stats = ref<JobStats>({
  pending: 0,
  processing: 0,
  completed: 0,
  failed: 0,
  totalToday: 0,
  averageDuration: 0
})
const isLoading = ref(true)
const error = ref<string | null>(null)

const currentPage = ref(1)
const pageSize = ref(50)
const totalItems = ref(0)

const filters = ref<JobFilters>({})
const selectedStatus = ref<string>('all')

const fetchStats = async (): Promise<void> => {
  try {
    stats.value = await JobsService.getJobStats()
  } catch (err) {
    console.error('Failed to fetch stats:', err)
  }
}

const fetchJobs = async (): Promise<void> => {
  try {
    isLoading.value = true
    error.value = null

    const offset = (currentPage.value - 1) * pageSize.value
    const response = await JobsService.listJobs(filters.value, pageSize.value, offset)

    jobs.value = response.data.jobs
    totalItems.value = response.data.pagination.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    jobs.value = []
    totalItems.value = 0
  } finally {
    isLoading.value = false
  }
}

const refreshData = async (): Promise<void> => {
  await Promise.all([fetchStats(), fetchJobs()])
}



const handlePageChange = async (page: number) => {
  currentPage.value = page
  await fetchJobs()
}

const handlePageSizeChange = async (newPageSize: number) => {
  pageSize.value = newPageSize
  currentPage.value = 1
  await fetchJobs()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleStatusFilter = (value: any) => {
  if (value === 'all' || !value || typeof value !== 'string') {
    filters.value.status = undefined
    selectedStatus.value = 'all'
  } else {
    filters.value.status = value as JobStatus
    selectedStatus.value = value
  }
  currentPage.value = 1
  fetchJobs()
}

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}



onMounted(async () => {
  await Promise.all([fetchStats(), fetchJobs()])
})
</script>

<template>
  <DashboardLayout title="Background Jobs">
    <div class="space-y-6">
      <div>
        <p class="text-muted-foreground">
          Monitor and track background job execution
        </p>
      </div>

      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">Pending</CardTitle>
            <Clock class="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">{{ stats.pending }}</div>
            <p class="text-xs text-muted-foreground">Waiting to process</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">Processing</CardTitle>
            <Play class="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">{{ stats.processing }}</div>
            <p class="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 class="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">{{ stats.completed }}</div>
            <p class="text-xs text-muted-foreground">
              {{ stats.totalToday }} today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">Failed</CardTitle>
            <XCircle class="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">{{ stats.failed }}</div>
            <p class="text-xs text-muted-foreground">
              Avg: {{ formatDuration(stats.averageDuration) }}
            </p>
          </CardContent>
        </Card>
      </div>

      <div v-if="isLoading" class="text-muted-foreground">
        Loading jobs...
      </div>

      <div v-else-if="error" class="text-red-500">
        Error: {{ error }}
      </div>

      <div v-else class="space-y-4">
        <div class="flex items-center gap-4">
          <Select v-model="selectedStatus" @update:model-value="handleStatusFilter">
            <SelectTrigger class="w-[180px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            @click="refreshData"
            :disabled="isLoading"
          >
            <RefreshCw class="h-4 w-4 mr-2" :class="{ 'animate-spin': isLoading }" />
            Refresh
          </Button>
        </div>

        <JobTableColumns :jobs="jobs" />

        <PaginationControls
          :current-page="currentPage"
          :page-size="pageSize"
          :total-items="totalItems"
          :is-loading="isLoading"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
        />
      </div>
    </div>
  </DashboardLayout>
</template>
