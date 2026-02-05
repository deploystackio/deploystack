<script setup lang="ts">
import { computed } from 'vue'
import { CircleCheck, CircleX, CircleDashed, Loader2, Clock } from 'lucide-vue-next'
import type { Component } from 'vue'

interface Props {
  status: 'pending' | 'acknowledged' | 'executing' | 'completed' | 'failed'
}

const props = defineProps<Props>()

const statusIcon = computed<Component>(() => {
  switch (props.status) {
    case 'completed':
      return CircleCheck
    case 'failed':
      return CircleX
    case 'executing':
      return Loader2
    case 'acknowledged':
      return CircleDashed
    case 'pending':
      return Clock
    default:
      return Clock
  }
})

const statusIconClass = computed(() => {
  switch (props.status) {
    case 'completed':
      return 'size-3 fill-green-500 text-green-500 dark:fill-green-400 dark:text-green-400'
    case 'failed':
      return 'size-3 fill-red-500 text-red-500 dark:fill-red-400 dark:text-red-400'
    case 'executing':
      return 'size-3 fill-blue-500 text-blue-500 dark:fill-blue-400 dark:text-blue-400 animate-spin'
    case 'acknowledged':
      return 'size-3 fill-blue-500 text-blue-500 dark:fill-blue-400 dark:text-blue-400'
    case 'pending':
      return 'size-3 text-muted-foreground'
    default:
      return 'size-3 text-muted-foreground'
  }
})

const statusText = computed(() => {
  return props.status.charAt(0).toUpperCase() + props.status.slice(1)
})
</script>

<template>
  <div class="inline-flex items-center justify-center rounded-full border px-1.5 py-0.5 text-xs font-medium text-muted-foreground gap-1">
    <component :is="statusIcon" :class="statusIconClass" />
    <span>{{ statusText }}</span>
  </div>
</template>
