<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { RefreshCw, Clock, Play, CheckCircle2, XCircle, Search, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { JobsService } from '@/services/jobsService'
import JobTableColumns from './JobTableColumns.vue'
import PaginationControls from '@/components/ui/pagination/PaginationControls.vue'
import type { Job, JobStats, JobFilters, JobStatus, SearchJobsParams } from './types'

const { setBreadcrumbs } = useBreadcrumbs()

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

const selectedSearchStatus = ref<string>('all')
const selectedSearchType = ref<string>('all')
const selectedTimeRange = ref<string>('all')
const searchJobId = ref<string>('')
const isSearching = ref(false)

const hasActiveSearch = computed(() => {
  return !!(searchJobId.value ||
           selectedSearchType.value !== 'all' ||
           selectedSearchStatus.value !== 'all' ||
           selectedTimeRange.value !== 'all')
})

const jobTypes = ref<string[]>([])

const fetchStats = async (): Promise<void> => {
  try {
    stats.value = await JobsService.getJobStats()
  } catch (err) {
    console.error('Failed to fetch stats:', err)
  }
}

const fetchJobTypes = async (): Promise<void> => {
  try {
    jobTypes.value = await JobsService.getJobTypes()
  } catch (err) {
    console.error('Failed to fetch job types:', err)
    jobTypes.value = []
  }
}

const calculateTimeRangeTimestamp = (range: string): string | undefined => {
  if (range === 'all') return undefined

  const now = new Date()
  let millisecondsAgo = 0

  switch (range) {
    case '1min':
      millisecondsAgo = 60 * 1000
      break
    case '5min':
      millisecondsAgo = 5 * 60 * 1000
      break
    case '30min':
      millisecondsAgo = 30 * 60 * 1000
      break
    case '1h':
      millisecondsAgo = 60 * 60 * 1000
      break
    case '24h':
      millisecondsAgo = 24 * 60 * 60 * 1000
      break
    case '7d':
      millisecondsAgo = 7 * 24 * 60 * 60 * 1000
      break
    default:
      return undefined
  }

  return new Date(now.getTime() - millisecondsAgo).toISOString()
}

const fetchJobs = async (): Promise<void> => {
  try {
    isLoading.value = true
    error.value = null

    const offset = (currentPage.value - 1) * pageSize.value

    if (hasActiveSearch.value) {
      const params: SearchJobsParams = {
        limit: pageSize.value,
        offset: offset
      }

      if (searchJobId.value) params.id = searchJobId.value
      if (selectedSearchType.value !== 'all') params.type = selectedSearchType.value
      if (selectedSearchStatus.value !== 'all') params.status = selectedSearchStatus.value as JobStatus

      const timeRangeTimestamp = calculateTimeRangeTimestamp(selectedTimeRange.value)
      if (timeRangeTimestamp) params.created_after = timeRangeTimestamp

      const response = await JobsService.searchJobs(params)
      jobs.value = response.data.jobs
      totalItems.value = response.data.pagination.total
    } else {
      const response = await JobsService.listJobs(filters.value, pageSize.value, offset)
      jobs.value = response.data.jobs
      totalItems.value = response.data.pagination.total
    }
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

const handleSearch = async () => {
  isSearching.value = true
  currentPage.value = 1
  try {
    await fetchJobs()
  } finally {
    isSearching.value = false
  }
}

const handleClearSearch = async () => {
  searchJobId.value = ''
  selectedSearchType.value = 'all'
  selectedSearchStatus.value = 'all'
  selectedTimeRange.value = 'all'
  currentPage.value = 1
  await fetchJobs()
}

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}



onMounted(async () => {
  setBreadcrumbs([{ label: 'Background Jobs' }])
  await Promise.all([fetchStats(), fetchJobTypes(), fetchJobs()])
})
</script>

<template>
  <DashboardLayout>
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
        <div class="flex flex-wrap items-center gap-3">
          <Input
            v-model="searchJobId"
            placeholder="Job ID..."
            class="w-[200px]"
          />

          <Select v-model="selectedSearchType">
            <SelectTrigger class="w-[180px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem v-for="type in jobTypes" :key="type" :value="type">
                {{ type }}
              </SelectItem>
            </SelectContent>
          </Select>

          <Select v-model="selectedSearchStatus">
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

          <Select v-model="selectedTimeRange">
            <SelectTrigger class="w-[180px]">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="1min">Last 1 minute</SelectItem>
              <SelectItem value="5min">Last 5 minutes</SelectItem>
              <SelectItem value="30min">Last 30 minutes</SelectItem>
              <SelectItem value="1h">Last 1 hour</SelectItem>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
            </SelectContent>
          </Select>

          <div class="flex items-center gap-2 ml-auto">
            <Button
              :loading="isSearching"
              loading-text="Searching..."
              @click="handleSearch"
              size="sm"
            >
              <Search v-if="!isSearching" class="h-4 w-4 mr-2" />
              Search
            </Button>

            <Button
              v-if="hasActiveSearch"
              variant="outline"
              size="sm"
              @click="handleClearSearch"
            >
              <X class="h-4 w-4 mr-2" />
              Clear
            </Button>

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
