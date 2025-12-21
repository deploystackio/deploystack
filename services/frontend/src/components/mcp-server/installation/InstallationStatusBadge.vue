<script setup lang="ts">
import { computed } from 'vue'
import { CircleCheck, Loader, AlertCircle, CircleX } from 'lucide-vue-next'
import { Skeleton } from '@/components/ui/skeleton'
import type { InstallationStatus, InstallationStatusData } from '@/types/mcp-installations'

interface Props {
  statusData: InstallationStatusData | null
  size?: 'sm' | 'default'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'sm'
})

// Map status to icon and color
const statusIcon = computed(() => {
  if (!props.statusData) return null

  const status = props.statusData.status

  switch (status) {
    case 'online':
      return { component: CircleCheck, class: 'fill-green-500 text-green-500 dark:fill-green-400 dark:text-green-400' }
    case 'provisioning':
    case 'command_received':
    case 'connecting':
    case 'discovering_tools':
    case 'syncing_tools':
      return { component: Loader, class: 'fill-blue-500 text-blue-500 dark:fill-blue-400 dark:text-blue-400 animate-spin' }
    case 'offline':
    case 'requires_reauth':
      return { component: AlertCircle, class: 'fill-yellow-500 text-yellow-500 dark:fill-yellow-400 dark:text-yellow-400' }
    case 'error':
    case 'permanently_failed':
      return { component: CircleX, class: 'fill-red-500 text-red-500 dark:fill-red-400 dark:text-red-400' }
    default:
      return { component: AlertCircle, class: 'fill-gray-500 text-gray-500 dark:fill-gray-400 dark:text-gray-400' }
  }
})

// Human-readable status labels
const statusLabel = computed(() => {
  if (!props.statusData) return null

  const status = props.statusData.status

  const labels: Record<InstallationStatus, string> = {
    provisioning: 'Provisioning',
    command_received: 'Command Received',
    connecting: 'Connecting',
    discovering_tools: 'Discovering Tools',
    syncing_tools: 'Syncing Tools',
    online: 'Online',
    offline: 'Offline',
    error: 'Error',
    requires_reauth: 'Reauth Required',
    permanently_failed: 'Failed'
  }

  return labels[status] || status
})

// Size-dependent classes
const sizeClasses = computed(() => {
  if (props.size === 'default') {
    return {
      skeleton: 'h-8 w-28',
      container: 'px-2.5 py-1 text-sm gap-1.5',
      icon: 'size-4'
    }
  }
  return {
    skeleton: 'h-6 w-20',
    container: 'px-1.5 py-0.5 text-xs gap-1',
    icon: 'size-3'
  }
})
</script>

<template>
  <Skeleton v-if="!statusData" :class="sizeClasses.skeleton" />
  <div v-else-if="statusIcon && statusLabel" :class="['inline-flex items-center justify-center rounded-full border font-medium text-muted-foreground', sizeClasses.container]">
    <component :is="statusIcon.component" :class="[sizeClasses.icon, statusIcon.class]" />
    <span>{{ statusLabel }}</span>
  </div>
</template>
