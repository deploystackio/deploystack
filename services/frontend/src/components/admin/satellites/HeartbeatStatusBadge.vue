<script setup lang="ts">
import { computed } from 'vue'
import { CircleCheck, CircleAlert, CircleX } from 'lucide-vue-next'
import type { Component } from 'vue'

interface Props {
  status: 'active' | 'degraded' | 'error'
}

const props = defineProps<Props>()

const statusIcon = computed<Component>(() => {
  switch (props.status) {
    case 'active':
      return CircleCheck
    case 'degraded':
      return CircleAlert
    case 'error':
      return CircleX
    default:
      return CircleCheck
  }
})

const statusIconClass = computed(() => {
  switch (props.status) {
    case 'active':
      return 'size-3 fill-green-500 text-green-500 dark:fill-green-400 dark:text-green-400'
    case 'degraded':
      return 'size-3 fill-yellow-500 text-yellow-500 dark:fill-yellow-400 dark:text-yellow-400'
    case 'error':
      return 'size-3 fill-red-500 text-red-500 dark:fill-red-400 dark:text-red-400'
    default:
      return 'size-3 fill-green-500 text-green-500 dark:fill-green-400 dark:text-green-400'
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
