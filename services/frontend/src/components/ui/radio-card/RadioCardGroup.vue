<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { provide, reactive, watch, ref, onMounted, onUpdated } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  modelValue: string
  name?: string
  disabled?: boolean
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// Create reactive object for group value
const groupValue = reactive({ value: props.modelValue })

// Track total number of cards in the group
const totalCards = ref(0)

// Watch for modelValue changes and update reactive object
watch(() => props.modelValue, (newValue) => {
  groupValue.value = newValue
})

// Provide values to child RadioCard components
provide('radioCardGroupValue', groupValue)
provide('radioCardGroupName', props.name)
provide('radioCardGroupDisabled', props.disabled)
provide('radioCardGroupTotal', totalCards)

// Listen to child updates and emit
function handleUpdate(value: string) {
  groupValue.value = value
  emit('update:modelValue', value)
}

// Provide update function
provide('radioCardGroupUpdate', handleUpdate)

const containerRef = ref<HTMLElement | null>(null)

// Count cards on mount and update
function updateCardCount() {
  if (containerRef.value) {
    totalCards.value = containerRef.value.children.length
  }
}

onMounted(updateCardCount)
onUpdated(updateCardCount)
</script>

<template>
  <div ref="containerRef" :class="cn('rounded-lg [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-gray-200 [&>*:not(:last-child)]:dark:border-zinc-700', props.class)">
    <slot />
  </div>
</template>
