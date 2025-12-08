<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useVModel } from '@vueuse/core'
import { cn } from '@/lib/utils'

const props = defineProps<{
  defaultValue?: string | number
  modelValue?: string | number
  class?: HTMLAttributes['class']
  placeholder?: string
  disabled?: boolean
  type?: string
}>()

const emits = defineEmits<{
  (e: 'update:modelValue', payload: string | number): void
}>()

const modelValue = useVModel(props, 'modelValue', emits, {
  passive: true,
  defaultValue: props.defaultValue,
})
</script>

<template>
  <input
    v-model="modelValue"
    :type="type || 'text'"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="cn(
      'flex-1 h-9 min-w-0 bg-transparent px-3 py-1 text-base outline-none placeholder:text-muted-foreground md:text-sm',
      'disabled:pointer-events-none disabled:cursor-not-allowed',
      props.class
    )"
  >
</template>
