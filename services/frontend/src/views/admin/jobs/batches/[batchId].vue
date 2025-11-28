<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, RefreshCw, Copy } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { JobsService } from '@/services/jobsService'
import JobTableColumns from '../JobTableColumns.vue'
import type { BatchInfo, Job } from '../types'

const route = useRoute()
const router = useRouter()
const { setBreadcrumbs } = useBreadcrumbs()

const batch = ref<BatchInfo | null>(null)
const recentJobs = ref<Job[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

const batchId = computed(() => route.params.batchId as string)

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'completed':
      return 'default'
    case 'failed':
      return 'destructive'
    case 'processing':
      return 'secondary'
    case 'pending':
      return 'outline'
    default:
      return 'outline'
  }
}

const progressPercentage = computed(() => {
  if (!batch.value) return 0
  return Math.round(batch.value.progress * 100)
})

const inProgressJobs = computed(() => {
  if (!batch.value) return 0
  return batch.value.totalJobs - batch.value.completedJobs - batch.value.failedJobs
})

const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleString()
}

const copyToClipboard = (text: string, label: string) => {
  navigator.clipboard.writeText(text)
  toast.success(`${label} copied to clipboard`)
}

const handleBack = () => {
  router.push('/admin/jobs')
}

const fetchBatchStatus = async (): Promise<void> => {
  try {
    isLoading.value = true
    error.value = null

    const response = await JobsService.getBatchStatus(batchId.value)
    batch.value = response.batch
    recentJobs.value = response.recentJobs

    // Update breadcrumbs with batch ID
    if (batch.value) {
      setBreadcrumbs([
        { label: 'Background Jobs', href: '/admin/jobs' },
        { label: `Batch ${batch.value.id.substring(0, 8)}` }
      ])
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load batch'
  } finally {
    isLoading.value = false
  }
}

const refreshBatch = async (): Promise<void> => {
  await fetchBatchStatus()
  toast.success('Batch status refreshed')
}

onMounted(async () => {
  setBreadcrumbs([
    { label: 'Background Jobs', href: '/admin/jobs' },
    { label: 'Batch Status' }
  ])
  await fetchBatchStatus()
})
</script>

<template>
  <DashboardLayout>
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <Button variant="ghost" @click="handleBack">
          <ArrowLeft class="h-4 w-4 mr-2" />
          Back to Jobs
        </Button>
        <Button
          variant="outline"
          size="sm"
          @click="refreshBatch"
          :disabled="isLoading"
        >
          <RefreshCw class="h-4 w-4 mr-2" :class="{ 'animate-spin': isLoading }" />
          Refresh
        </Button>
      </div>

      <div v-if="isLoading && !batch" class="text-muted-foreground">
        Loading batch status...
      </div>

      <div v-else-if="error" class="text-red-500">
        Error: {{ error }}
      </div>

      <div v-else-if="batch" class="space-y-6">
        <Card>
          <CardHeader>
            <div class="flex items-center justify-between">
              <CardTitle>Batch Status</CardTitle>
              <Badge :variant="getStatusVariant(batch.status)" class="text-base">
                {{ batch.status }}
              </Badge>
            </div>
          </CardHeader>
          <CardContent class="space-y-4">
            <div>
              <p class="text-sm font-medium text-muted-foreground mb-2">Batch ID</p>
              <div class="flex items-center gap-2">
                <code class="text-sm">{{ batch.id }}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  @click="copyToClipboard(batch.id, 'Batch ID')"
                >
                  <Copy class="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div>
              <p class="text-sm font-medium text-muted-foreground mb-2">Type</p>
              <Badge variant="outline" class="font-mono">{{ batch.type }}</Badge>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-sm font-medium text-muted-foreground">Created</p>
                <p class="text-sm">{{ formatDate(batch.createdAt) }}</p>
              </div>

              <div>
                <p class="text-sm font-medium text-muted-foreground">Completed</p>
                <p class="text-sm">{{ formatDate(batch.completedAt) }}</p>
              </div>
            </div>

            <div v-if="batch.estimatedCompletion && (batch.status === 'processing' || batch.status === 'pending')">
              <p class="text-sm font-medium text-muted-foreground">Estimated Completion</p>
              <p class="text-sm">{{ batch.estimatedCompletion }}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progress Overview</CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="space-y-2">
              <div class="flex justify-between text-sm">
                <span>{{ progressPercentage }}% Complete</span>
                <span>{{ batch.completedJobs + batch.failedJobs }} / {{ batch.totalJobs }} jobs</span>
              </div>
              <Progress :model-value="progressPercentage" class="h-3" />
            </div>

            <div class="grid grid-cols-4 gap-4 pt-4">
              <div class="text-center">
                <p class="text-2xl font-bold text-green-600">{{ batch.completedJobs }}</p>
                <p class="text-xs text-muted-foreground">Completed</p>
              </div>
              <div class="text-center">
                <p class="text-2xl font-bold text-red-600">{{ batch.failedJobs }}</p>
                <p class="text-xs text-muted-foreground">Failed</p>
              </div>
              <div class="text-center">
                <p class="text-2xl font-bold text-blue-600">{{ inProgressJobs }}</p>
                <p class="text-xs text-muted-foreground">In Progress</p>
              </div>
              <div class="text-center">
                <p class="text-2xl font-bold">{{ batch.totalJobs }}</p>
                <p class="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <h3 class="text-lg font-medium mb-4">Recent Jobs</h3>
          <JobTableColumns :jobs="recentJobs" />
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>
