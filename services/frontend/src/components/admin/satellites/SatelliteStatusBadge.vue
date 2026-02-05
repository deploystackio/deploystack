<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CircleCheck, CircleMinus, CircleAlert, CircleX } from 'lucide-vue-next'
import type { Satellite } from '@/services/satelliteService'
import type { Component } from 'vue'

interface Props {
  status: Satellite['status']
}

const props = defineProps<Props>()
const { t } = useI18n()

const statusIcon = computed<Component>(() => {
  switch (props.status) {
    case 'active':
      return CircleCheck
    case 'inactive':
      return CircleMinus
    case 'maintenance':
      return CircleAlert
    case 'error':
      return CircleX
    default:
      return CircleMinus
  }
})

const statusIconClass = computed(() => {
  switch (props.status) {
    case 'active':
      return 'size-3 fill-green-500 text-green-500 dark:fill-green-400 dark:text-green-400'
    case 'inactive':
      return 'size-3 text-muted-foreground'
    case 'maintenance':
      return 'size-3 fill-yellow-500 text-yellow-500 dark:fill-yellow-400 dark:text-yellow-400'
    case 'error':
      return 'size-3 fill-red-500 text-red-500 dark:fill-red-400 dark:text-red-400'
    default:
      return 'size-3 text-muted-foreground'
  }
})
</script>

<template>
  <div class="inline-flex items-center justify-center rounded-full border px-1.5 py-0.5 text-xs font-medium text-muted-foreground gap-1">
    <component :is="statusIcon" :class="statusIconClass" />
    <span>{{ t(`satellites.status.${status}`) }}</span>
  </div>
</template>
