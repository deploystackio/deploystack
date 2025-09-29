<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye } from 'lucide-vue-next'
import type { Job } from './types'

interface Props {
  jobs: Job[]
}

const props = defineProps<Props>()
const router = useRouter()

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

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

const truncateId = (id: string): string => {
  return id.length > 8 ? `${id.substring(0, 8)}...` : id
}

const handleViewJob = (jobId: string) => {
  router.push(`/admin/jobs/${jobId}`)
}

const sortedJobs = computed(() => {
  return [...props.jobs].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
})
</script>

<template>
  <div class="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Job ID</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Attempts</TableHead>
          <TableHead class="w-[100px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-if="sortedJobs.length === 0">
          <TableCell :colspan="6" class="h-24 text-center">
            No jobs found
          </TableCell>
        </TableRow>

        <TableRow v-for="job in sortedJobs" :key="job.id">
          <TableCell class="font-mono text-sm">
            <span :title="job.id">{{ truncateId(job.id) }}</span>
          </TableCell>

          <TableCell>
            <Badge variant="outline" class="font-mono text-xs">
              {{ job.type }}
            </Badge>
          </TableCell>

          <TableCell>
            <Badge :variant="getStatusVariant(job.status)">
              {{ job.status }}
            </Badge>
          </TableCell>

          <TableCell class="text-sm text-muted-foreground">
            <span :title="new Date(job.created_at).toLocaleString()">
              {{ formatRelativeTime(job.created_at) }}
            </span>
          </TableCell>

          <TableCell class="text-sm">
            <span :class="job.attempts > 1 ? 'text-yellow-600 font-medium' : ''">
              {{ job.attempts }} / {{ job.max_attempts }}
            </span>
          </TableCell>

          <TableCell>
            <Button
              variant="outline"
              size="sm"
              @click="handleViewJob(job.id)"
              class="h-8"
            >
              <Eye class="h-4 w-4 mr-2" />
              View
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
