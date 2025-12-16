<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { inject, onMounted, onUnmounted } from 'vue'
import { useId } from 'reka-ui'
import { cn } from '@/lib/utils'

export interface MeterLabelProps {
  /** Optional ID for the label (auto-generated if not provided) */
  id?: string
  /** Additional CSS classes */
  class?: HTMLAttributes['class']
}

const props = defineProps<MeterLabelProps>()

// Inject meter context
const meterContext = inject<{
  setLabelId: (id: string | undefined) => void
}>('meter')

if (!meterContext) {
  throw new Error('MeterLabel must be used within a Meter component')
}

// Generate or use provided ID
const labelId = props.id || useId()

// Register label ID with meter on mount
onMounted(() => {
  meterContext.setLabelId(labelId)
})

// Cleanup on unmount
onUnmounted(() => {
  meterContext.setLabelId(undefined)
})
</script>

<template>
  <span
    :id="labelId"
    :class="cn('text-sm font-medium leading-none', props.class)"
  >
    <slot />
  </span>
</template>
