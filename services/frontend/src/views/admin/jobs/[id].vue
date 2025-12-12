<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { DsCard } from '@/components/ui/ds-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CodeHighlight } from '@/components/ui/code-highlight'
import { Skeleton } from '@/components/ui/skeleton'
import { Copy, ExternalLink, CircleCheck, CircleX, CircleAlert, CircleMinus } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { Spinner } from '@/components/ui/spinner'
import { DsPageHeading } from '@/components/ui/ds-page-heading'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { JobsService } from '@/services/jobsService'
import type { Job } from './types'

const route = useRoute()
const router = useRouter()
const { setBreadcrumbs } = useBreadcrumbs()

const job = ref<Job | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

const jobId = computed(() => route.params.id as string)

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
  <NavbarLayout>
    <DsPageHeading title="Job Details">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink as-child>
              <RouterLink to="/admin/jobs">Background Jobs</RouterLink>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Job Details</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <template #actions>
        <Button
          variant="outline"
          @click="refreshJob"
          :disabled="isLoading"
        >
          <Spinner v-if="isLoading" class="mr-2" />
          Refresh
        </Button>
      </template>
    </DsPageHeading>

    <div class="space-y-6">
      <template v-if="isLoading">
        <DsCard title="Job Details">
          <div class="grid grid-cols-2 gap-4">
            <div v-for="i in 9" :key="i">
              <Skeleton class="h-4 w-20 mb-2" />
              <Skeleton class="h-5 w-32" />
            </div>
          </div>
        </DsCard>

        <DsCard title="Payload (Input)">
          <Skeleton class="h-32 w-full" />
        </DsCard>
      </template>

      <div v-else-if="error" class="text-red-500">
        Error: {{ error }}
      </div>

      <div v-else-if="job" class="space-y-6">
        <DsCard title="Job Details">
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
              <p class="text-sm font-medium text-muted-foreground">Status</p>
              <div class="inline-flex items-center justify-center rounded-full border px-1.5 py-0.5 text-xs font-medium text-muted-foreground gap-1">
                <CircleCheck
                  v-if="job.status === 'completed'"
                  class="size-3 fill-green-500 text-green-500 dark:fill-green-400 dark:text-green-400"
                />
                <CircleMinus
                  v-else-if="job.status === 'pending'"
                  class="size-3 text-muted-foreground"
                />
                <CircleAlert
                  v-else-if="job.status === 'processing'"
                  class="size-3 fill-yellow-500 text-yellow-500 dark:fill-yellow-400 dark:text-yellow-400"
                />
                <CircleX
                  v-else-if="job.status === 'failed'"
                  class="size-3 fill-red-500 text-red-500 dark:fill-red-400 dark:text-red-400"
                />
                <span>{{ job.status }}</span>
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

          <template v-if="job.batch_id" #footer-actions>
            <Button variant="outline" size="sm" @click="handleViewBatch">
              <ExternalLink class="h-4 w-4 mr-2" />
              View Batch {{ job.batch_id.substring(0, 8) }}
            </Button>
          </template>
        </DsCard>

        <DsCard v-if="job.error" title="Error Details">
          <Alert variant="destructive">
            <AlertDescription class="font-mono text-sm whitespace-pre-wrap">
              {{ job.error }}
            </AlertDescription>
          </Alert>
        </DsCard>

        <DsCard title="Payload (Input)">
          <CodeHighlight :code="formatPayload(job.payload)" language="json" />

          <template #footer-actions>
            <Button variant="outline" size="sm" @click="copyToClipboard(formatPayload(job.payload), 'Payload')">
              <Copy class="h-4 w-4 mr-2" />
              Copy
            </Button>
          </template>
        </DsCard>

        <DsCard v-if="job.result" title="Result (Output)">
          <CodeHighlight :code="formatPayload(job.result)" language="json" />

          <template #footer-actions>
            <Button variant="outline" size="sm" @click="copyToClipboard(formatPayload(job.result), 'Result')">
              <Copy class="h-4 w-4 mr-2" />
              Copy
            </Button>
          </template>
        </DsCard>
      </div>
    </div>
  </NavbarLayout>
</template>
