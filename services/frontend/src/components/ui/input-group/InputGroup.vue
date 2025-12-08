<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
  disabled?: boolean
}>()
</script>

<template>
  <div
    :class="cn(
      'flex items-center rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow]',
      'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
      'has-[input:disabled]:opacity-50 has-[input:disabled]:cursor-not-allowed',
      props.class
    )"
    :data-disabled="disabled || undefined"
  >
    <slot />
  </div>
</template>
