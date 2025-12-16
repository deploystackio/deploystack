<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed, inject } from 'vue'
import { cn } from '@/lib/utils'

export interface MeterIndicatorProps {
  /** Additional CSS classes */
  class?: HTMLAttributes['class']
}

const props = defineProps<MeterIndicatorProps>()

// Inject meter context
const meterContext = inject<{
  value: { value: number }
  min: { value: number }
  max: { value: number }
}>('meter')

if (!meterContext) {
  throw new Error('MeterIndicator must be used within a Meter component')
}

// Calculate percentage width
const percentageWidth = computed(() => {
  const { value, min, max } = meterContext
  return ((value.value - min.value) * 100) / (max.value - min.value)
})
</script>

<template>
  <div
    :class="cn('h-full bg-primary transition-all', props.class)"
    :style="{
      width: `${percentageWidth}%`,
    }"
  />
</template>
