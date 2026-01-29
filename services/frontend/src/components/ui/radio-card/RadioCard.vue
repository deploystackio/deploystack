<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed, inject, onMounted, ref } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  modelValue?: string
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

// Inject from RadioCardGroup if available
const groupValue = inject<{ value: string } | undefined>('radioCardGroupValue', undefined)
const groupName = inject<string | undefined>('radioCardGroupName', undefined)
const groupDisabled = inject<boolean | undefined>('radioCardGroupDisabled', undefined)
const groupUpdate = inject<((value: string) => void) | undefined>('radioCardGroupUpdate', undefined)
const groupTotal = inject<{ value: number } | undefined>('radioCardGroupTotal', undefined)

const cardRef = ref<HTMLElement | null>(null)
const cardIndex = ref<number>(-1)

const isChecked = computed(() => {
  if (groupValue) {
    return groupValue.value === props.value
  }
  return props.modelValue === props.value
})

const inputName = computed(() => props.name || groupName || 'radio-card')
const isDisabled = computed(() => props.disabled || groupDisabled || false)

// Determine position in group
const isFirstCard = computed(() => cardIndex.value === 0)
const isLastCard = computed(() => {
  if (!groupTotal) return false
  return cardIndex.value === groupTotal.value - 1
})
const isSingleCard = computed(() => groupTotal?.value === 1)

// Calculate border classes based on position
const borderClasses = computed(() => {
  if (!groupTotal) {
    // Standalone card - all borders with full rounding (2px)
    return 'border-2 rounded-lg'
  }

  if (isSingleCard.value) {
    return 'border-2 rounded-lg'
  } else if (isFirstCard.value) {
    return 'border-2 border-b-0 rounded-t-lg'
  } else if (isLastCard.value) {
    return 'border-2 border-t-0 rounded-b-lg'
  } else {
    return 'border-x-2 border-b-0 border-t-0'
  }
})

function handleChange() {
  if (isDisabled.value) return

  // If part of a group, use group update function
  if (groupUpdate) {
    groupUpdate(props.value)
  } else {
    // Otherwise emit directly
    emit('update:modelValue', props.value)
  }
}

onMounted(() => {
  // Find index of this card in parent
  if (cardRef.value?.parentElement) {
    const siblings = Array.from(cardRef.value.parentElement.children)
    cardIndex.value = siblings.indexOf(cardRef.value)
  }
})
</script>

<template>
  <label
    ref="cardRef"
    :class="cn(
      'flex items-start gap-3 p-4 cursor-pointer transition-colors',
      borderClasses,
      'border-gray-200 dark:border-zinc-700',
      'hover:bg-gray-50 dark:hover:bg-zinc-800/50',
      'has-[:checked]:border-indigo-600 dark:has-[:checked]:border-indigo-500',
      isDisabled && 'opacity-50 cursor-not-allowed',
      props.class
    )"
  >
    <input
      :checked="isChecked"
      :name="inputName"
      :value="value"
      :disabled="isDisabled"
      type="radio"
      class="mt-0.5 h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-600 cursor-pointer disabled:cursor-not-allowed"
      @change="handleChange"
    />
    <div class="flex-1">
      <div v-if="$slots.title" class="text-sm font-medium text-gray-900 dark:text-zinc-100">
        <slot name="title" />
      </div>
      <div v-if="$slots.description" class="mt-1">
        <slot name="description" />
      </div>
      <slot />
    </div>
  </label>
</template>
