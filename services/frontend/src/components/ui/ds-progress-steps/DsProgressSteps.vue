<!--
@component DsProgressSteps
@description A vertical progress step indicator for multi-step flows with support for completed, active, and pending states.

@example
<DsProgressSteps :steps="steps" :current-step="1">
  <template #step-content-1>
    <YourFormContent />
  </template>
</DsProgressSteps>

@props
- steps: Array of step objects with { id, title, description? }
- currentStep: Currently active step index
- completedSteps: Array of completed step indices
- maxWidth: Maximum width class (default: 'max-w-2xl')

@slots
- step-content-{index}: Content for active step

@accessibility
- Uses proper ARIA attributes for progress indication
- Semantic step structure
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Check, Circle, Dot } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

export interface ProgressStep {
  id: string | number
  title: string
  description?: string
}

interface Props {
  steps: ProgressStep[]
  currentStep: number
  completedSteps?: number[]
  maxWidth?: string
}

const props = withDefaults(defineProps<Props>(), {
  completedSteps: () => [],
  maxWidth: 'max-w-2xl'
})

const getStepStatus = (stepIndex: number) => {
  if (props.completedSteps.includes(stepIndex)) {
    return 'completed'
  }
  if (stepIndex === props.currentStep) {
    return 'active'
  }
  return 'pending'
}

const getStepIcon = (stepIndex: number) => {
  const status = getStepStatus(stepIndex)

  switch (status) {
    case 'completed':
      return Check
    case 'active':
      return Dot
    default:
      return Circle
  }
}

const getStepClasses = (stepIndex: number) => {
  const status = getStepStatus(stepIndex)

  const baseClasses = 'rounded-lg transition-all duration-200'

  switch (status) {
    case 'completed':
      return cn(
        baseClasses,
        'bg-[#F6F6F6] dark:bg-zinc-900',
        'border border-transparent'
      )
    case 'active':
      return cn(
        baseClasses,
        'bg-white dark:bg-zinc-800',
        'border border-zinc-200 dark:border-zinc-700',
        'shadow-sm'
      )
    default:
      return cn(
        baseClasses,
        'bg-[#F6F6F6] dark:bg-zinc-900',
        'border border-transparent'
      )
  }
}

const getIconClasses = (stepIndex: number) => {
  const status = getStepStatus(stepIndex)

  switch (status) {
    case 'completed':
      return 'text-white bg-green-700 rounded-full p-1.5 stroke-[3]'
    case 'active':
      return 'text-white bg-gray-500 rounded-full p-1.5 stroke-[3]'
    default:
      return 'text-zinc-400 dark:text-zinc-600 fill-zinc-400 dark:fill-zinc-600'
  }
}

const getTextClasses = (stepIndex: number) => {
  const status = getStepStatus(stepIndex)

  switch (status) {
    case 'completed':
      return 'text-zinc-500 dark:text-zinc-500'
    case 'active':
      return 'text-zinc-900 dark:text-zinc-100'
    default:
      return 'text-zinc-500 dark:text-zinc-500'
  }
}

const hasSlotContent = (stepIndex: number) => {
  return !!slots[`step-content-${stepIndex}`]
}

const slots = defineSlots<{
  [key: `step-content-${number}`]: () => any
}>()
</script>

<template>
  <div :class="['flex flex-col items-center w-full mx-auto space-y-4 py-6', maxWidth]">
    <div
      v-for="(step, index) in steps"
      :key="step.id"
      :class="getStepClasses(index)"
      class="w-full p-6"
    >
      <!-- Title Row with Icon -->
      <div class="flex items-start gap-4">
        <!-- Icon -->
        <div class="flex-shrink-0 -mt-px">
          <component
            :is="getStepIcon(index)"
            :class="[
              'h-6 w-6',
              getIconClasses(index)
            ]"
          />
        </div>

        <!-- Title and Description -->
        <div class="flex-1 min-w-0">
          <h3
            :class="[
              'text-base font-semibold',
              getTextClasses(index)
            ]"
          >
            {{ step.title }}
          </h3>

          <p
            v-if="step.description && index === currentStep"
            class="mt-1 text-sm text-zinc-600 dark:text-zinc-400"
          >
            {{ step.description }}
          </p>
        </div>
      </div>

      <!-- Active Step Content (form, etc.) - Full Width -->
      <div
        v-if="index === currentStep && hasSlotContent(index)"
      >
        <hr class="my-4 -mx-6 border-zinc-200 dark:border-zinc-700" />
        <slot :name="`step-content-${index}`" />
      </div>
    </div>
  </div>
</template>
