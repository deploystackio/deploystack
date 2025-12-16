<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

export interface MeterTrackProps {
  /** Additional CSS classes */
  class?: HTMLAttributes['class']
}

const props = defineProps<MeterTrackProps>()
</script>

<template>
  <div
    :class="
      cn(
        'relative h-4 w-full overflow-hidden rounded-full bg-secondary',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
