<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed, provide, ref } from 'vue'
import { cn } from '@/lib/utils'

export interface MeterProps {
  /** Current value of the meter */
  value: number
  /** Minimum value (default: 0) */
  min?: number
  /** Maximum value (default: 100) */
  max?: number
  /** Custom locale for formatting (e.g., 'en-US', 'de-DE') */
  locale?: string
  /** Intl.NumberFormat options for custom formatting */
  format?: Intl.NumberFormatOptions
  /** Custom function to generate aria-valuetext */
  getAriaValueText?: (value: number, min: number, max: number) => string
  /** Additional CSS classes */
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<MeterProps>(), {
  min: 0,
  max: 100,
  locale: 'en-US',
})

// Label ID management for accessibility
const labelId = ref<string | undefined>(undefined)

// Format the value for display
const formattedValue = computed(() => {
  if (props.format) {
    return new Intl.NumberFormat(props.locale, props.format).format(props.value)
  }
  // Default: treat as percentage
  return new Intl.NumberFormat(props.locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(props.value / 100)
})

// Generate aria-valuetext
const ariaValueText = computed(() => {
  if (props.getAriaValueText) {
    return props.getAriaValueText(props.value, props.min, props.max)
  }
  return formattedValue.value
})

// Provide context for child components
provide('meter', {
  value: computed(() => props.value),
  min: computed(() => props.min),
  max: computed(() => props.max),
  formattedValue,
  labelId,
  setLabelId: (id: string | undefined) => {
    labelId.value = id
  },
})
</script>

<template>
  <div
    role="meter"
    :aria-valuenow="value"
    :aria-valuemin="min"
    :aria-valuemax="max"
    :aria-valuetext="ariaValueText"
    :aria-labelledby="labelId"
    :class="cn('relative', props.class)"
  >
    <slot />
  </div>
</template>
