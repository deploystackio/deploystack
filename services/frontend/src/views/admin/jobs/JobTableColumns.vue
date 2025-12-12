<script setup lang="ts">
import { computed } from 'vue'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CircleCheck, CircleX, CircleAlert, CircleMinus } from 'lucide-vue-next'
import type { Job } from './types'

interface Props {
  jobs: Job[]
  isLoading?: boolean
}

const props = defineProps<Props>()

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
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
        </TableRow>
      </TableHeader>
      <TableBody>
        <template v-if="isLoading">
          <TableRow v-for="i in 5" :key="`skeleton-${i}`">
            <TableCell>
              <Skeleton class="h-4 w-20" />
            </TableCell>
            <TableCell>
              <Skeleton class="h-5 w-24" />
            </TableCell>
            <TableCell>
              <Skeleton class="h-5 w-20" />
            </TableCell>
            <TableCell>
              <Skeleton class="h-4 w-16" />
            </TableCell>
            <TableCell>
              <Skeleton class="h-4 w-12" />
            </TableCell>
          </TableRow>
        </template>

        <template v-else>
          <TableRow v-if="sortedJobs.length === 0">
            <TableCell :colspan="5" class="h-24 text-center">
              No jobs found
            </TableCell>
          </TableRow>

          <TableRow v-for="job in sortedJobs" :key="job.id">
          <TableCell class="text-sm">
            <RouterLink :to="`/admin/jobs/${job.id}`" class="link">
              {{ job.id }}
            </RouterLink>
          </TableCell>

          <TableCell>
            <Badge variant="outline" class="font-mono text-xs">
              {{ job.type }}
            </Badge>
          </TableCell>

          <TableCell>
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
        </TableRow>
        </template>
      </TableBody>
    </Table>
  </div>
</template>
