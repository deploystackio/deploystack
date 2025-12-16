<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { inject } from 'vue'
import { cn } from '@/lib/utils'

export interface MeterValueProps {
  /** Additional CSS classes */
  class?: HTMLAttributes['class']
}

const props = defineProps<MeterValueProps>()

// Inject meter context
const meterContext = inject<{
  value: { value: number }
  formattedValue: { value: string }
}>('meter')

if (!meterContext) {
  throw new Error('MeterValue must be used within a Meter component')
}
</script>

<template>
  <span
    aria-hidden="true"
    :class="cn('text-sm font-medium', props.class)"
  >
    <slot
      :formatted-value="meterContext.formattedValue.value"
      :value="meterContext.value.value"
    >
      {{ meterContext.formattedValue.value }}
    </slot>
  </span>
</template>
