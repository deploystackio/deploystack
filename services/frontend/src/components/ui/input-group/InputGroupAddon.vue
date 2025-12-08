<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
  align?: 'start' | 'end' | 'inline-start' | 'inline-end'
}>()

const alignmentClasses = {
  'start': 'order-first pl-3',
  'end': 'order-last pr-3',
  'inline-start': 'order-first pl-3 border-r border-input bg-muted/50',
  'inline-end': 'order-last pr-3 border-l border-input bg-muted/50',
}
</script>

<template>
  <div
    :class="cn(
      'flex items-center justify-center text-muted-foreground [&>svg]:size-4',
      alignmentClasses[align || 'end'],
      props.class
    )"
  >
    <slot />
  </div>
</template>
