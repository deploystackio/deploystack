<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CodeHighlight } from '@/components/ui/code-highlight'
import { Copy, RefreshCw, ExternalLink } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { JobsService } from '@/services/jobsService'
import type { Job } from './types'

const route = useRoute()
const router = useRouter()
const { setBreadcrumbs } = useBreadcrumbs()

const job = ref<Job | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

const jobId = computed(() => route.params.id as string)

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

const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleString()
}

const formatDuration = (job: Job): string => {
  if (!job.completed_at) return 'In progress'
  
  const start = new Date(job.created_at).getTime()
  const end = new Date(job.completed_at).getTime()
  const ms = end - start
  
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

const formatPayload = (payload: unknown): string => {
  try {
    if (typeof payload === 'string') {
      const parsed = JSON.parse(payload)
      return JSON.stringify(parsed, null, 2)
    }
    return JSON.stringify(payload, null, 2)
  } catch {
    return String(payload)
  }
}

const copyToClipboard = (text: string, label: string) => {
  navigator.clipboard.writeText(text)
  toast.success(`${label} copied to clipboard`)
}

const handleViewBatch = () => {
  if (job.value?.batch_id) {
    router.push(`/admin/jobs/batches/${job.value.batch_id}`)
  }
}

const fetchJob = async (): Promise<void> => {
  try {
    isLoading.value = true
    error.value = null
    job.value = await JobsService.getJob(jobId.value)

    // Update breadcrumbs with job ID
    if (job.value) {
      setBreadcrumbs([
        { label: 'Background Jobs', href: '/admin/jobs' },
        { label: `Job ${job.value.id.substring(0, 8)}` }
      ])
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load job'
  } finally {
    isLoading.value = false
  }
}

const refreshJob = async (): Promise<void> => {
  await fetchJob()
  toast.success('Job details refreshed')
}

onMounted(() => {
  setBreadcrumbs([
    { label: 'Background Jobs', href: '/admin/jobs' },
    { label: 'Job Details' }
  ])
  fetchJob()
})
</script>

<template>
  <DashboardLayout>
    <div class="space-y-6">
      <div class="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          @click="refreshJob"
          :disabled="isLoading"
        >
          <RefreshCw class="h-4 w-4 mr-2" :class="{ 'animate-spin': isLoading }" />
          Refresh
        </Button>
      </div>

      <div v-if="isLoading" class="text-muted-foreground">
        Loading job details...
      </div>

      <div v-else-if="error" class="text-red-500">
        Error: {{ error }}
      </div>

      <div v-else-if="job" class="space-y-6">
        <Card>
          <CardHeader>
            <div class="flex items-center justify-between">
              <CardTitle>Job Status</CardTitle>
              <Badge :variant="getStatusVariant(job.status)" class="text-base">
                {{ job.status }}
              </Badge>
            </div>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-sm font-medium text-muted-foreground">Job ID</p>
                <div class="flex items-center gap-2">
                  <code class="text-sm">{{ job.id }}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    @click="copyToClipboard(job.id, 'Job ID')"
                  >
                    <Copy class="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div>
                <p class="text-sm font-medium text-muted-foreground">Type</p>
                <Badge variant="outline" class="font-mono">{{ job.type }}</Badge>
              </div>

              <div>
                <p class="text-sm font-medium text-muted-foreground">Created</p>
                <p class="text-sm">{{ formatDate(job.created_at) }}</p>
              </div>

              <div>
                <p class="text-sm font-medium text-muted-foreground">Last Updated</p>
                <p class="text-sm">{{ formatDate(job.updated_at) }}</p>
              </div>

              <div>
                <p class="text-sm font-medium text-muted-foreground">Completed</p>
                <p class="text-sm">{{ formatDate(job.completed_at) }}</p>
              </div>

              <div>
                <p class="text-sm font-medium text-muted-foreground">Duration</p>
                <p class="text-sm">{{ formatDuration(job) }}</p>
              </div>

              <div>
                <p class="text-sm font-medium text-muted-foreground">Attempts</p>
                <p class="text-sm">
                  {{ job.attempts }} / {{ job.max_attempts }}
                </p>
              </div>

              <div>
                <p class="text-sm font-medium text-muted-foreground">Scheduled For</p>
                <p class="text-sm">{{ formatDate(job.scheduled_for) }}</p>
              </div>
            </div>

            <div v-if="job.batch_id">
              <p class="text-sm font-medium text-muted-foreground mb-2">Batch</p>
              <Button variant="outline" size="sm" @click="handleViewBatch">
                <ExternalLink class="h-4 w-4 mr-2" />
                View Batch {{ job.batch_id.substring(0, 8) }}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card v-if="job.error">
          <CardHeader>
            <CardTitle class="text-red-600">Error Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription class="font-mono text-sm whitespace-pre-wrap">
                {{ job.error }}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <div>
          <h3 class="text-lg font-semibold mb-4">Payload (Input)</h3>
          <CodeHighlight :code="formatPayload(job.payload)" language="json" />
        </div>

        <div v-if="job.result">
          <h3 class="text-lg font-semibold mb-4">Result (Output)</h3>
          <CodeHighlight :code="formatPayload(job.result)" language="json" />
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>
