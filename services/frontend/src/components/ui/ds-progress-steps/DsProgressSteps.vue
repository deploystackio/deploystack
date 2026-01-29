<!--
@component DsProgressSteps
@description A vertical collapsible progress step indicator for multi-step flows with support for completed, active, and pending states.

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
- loadingSteps: Array of step indices that are in loading state
- maxWidth: Maximum width class (default: 'max-w-2xl')
- showBackButton: Show back button in footer (default: true)
- backButtonText: Text for back button (default: 'Back')
- nextButtonText: Text for next button (default: 'Next')
- isNextDisabled: Disable the next button (default: false)
- isProcessComplete: Lock all steps and disable all buttons when process is done (default: false)
- hideFooter: Completely hide the built-in footer, allowing steps to manage their own navigation (default: false)

@slots
- step-content-{index}: Content for each step

@events
- back: Emitted when back button is clicked
- next: Emitted when next button is clicked

@features
- Collapsible steps with chevron indicators
- Multiple steps can be open simultaneously
- Auto-collapse completed steps (but can be reopened)
- Clickable headers to toggle expand/collapse
- White background for active/completed steps

@accessibility
- Uses proper ARIA attributes for progress indication
- Semantic step structure
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { Check, Circle, Loader } from 'lucide-vue-next'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import DsProgressStepsHeader from './DsProgressStepsHeader.vue'
import DsProgressStepsFooter from './DsProgressStepsFooter.vue'

export interface ProgressStep {
  id: string | number
  title: string
  description?: string
}

interface Props {
  steps: ProgressStep[]
  currentStep: number
  completedSteps?: number[]
  loadingSteps?: number[]
  maxWidth?: string
  showBackButton?: boolean
  backButtonText?: string
  nextButtonText?: string
  isNextDisabled?: boolean
  isProcessComplete?: boolean
  hideFooter?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  completedSteps: () => [],
  loadingSteps: () => [],
  maxWidth: 'max-w-2xl',
  showBackButton: true,
  backButtonText: 'Back',
  nextButtonText: 'Next',
  isNextDisabled: false,
  isProcessComplete: false,
  hideFooter: false
})

const emit = defineEmits<{
  back: []
  next: []
}>()

// Track which steps are expanded (default: only current step)
const expandedSteps = ref<Set<number>>(new Set([props.currentStep]))

// Watch for step changes - expand new current step, collapse previous
watch(() => props.currentStep, (newStep, oldStep) => {
  expandedSteps.value.add(newStep)

  // Auto-collapse when step is completed (when moving to next step)
  if (oldStep !== undefined && props.completedSteps.includes(oldStep)) {
    expandedSteps.value.delete(oldStep)
  }
})

// Watch for completed steps - auto-collapse them
watch(() => props.completedSteps, (newCompleted) => {
  newCompleted.forEach(stepIndex => {
    if (stepIndex !== props.currentStep) {
      expandedSteps.value.delete(stepIndex)
    }
  })
}, { deep: true })

const canToggleStep = (stepIndex: number) => {
  // Can only toggle completed steps or current step
  return props.completedSteps.includes(stepIndex) || stepIndex === props.currentStep
}

const toggleStep = (stepIndex: number) => {
  // Only allow toggling if step is completed or current
  if (!canToggleStep(stepIndex)) {
    return
  }

  if (expandedSteps.value.has(stepIndex)) {
    expandedSteps.value.delete(stepIndex)
  } else {
    expandedSteps.value.add(stepIndex)
  }
}

const isExpanded = (stepIndex: number) => {
  return expandedSteps.value.has(stepIndex)
}

const getStepStatus = (stepIndex: number) => {
  if (props.loadingSteps.includes(stepIndex)) {
    return 'loading'
  }
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
    case 'loading':
      return Spinner
    case 'completed':
      return Check
    case 'active':
      return Loader
    default:
      return Circle
  }
}

const getStepClasses = (stepIndex: number) => {
  const status = getStepStatus(stepIndex)
  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === props.steps.length - 1
  const isSingleStep = props.steps.length === 1

  // Smart border application to prevent double borders
  let borderClasses = ''
  if (isSingleStep) {
    borderClasses = 'border' // All sides for standalone appearance
  } else if (isFirstStep) {
    borderClasses = 'border' // All sides (provides top border for stack)
  } else {
    borderClasses = 'border-x border-b' // Left, right, bottom only (no top to avoid double border)
  }

  const baseClasses = `${borderClasses} transition-all duration-200`

  // Determine rounding
  let roundingClasses = ''
  if (isSingleStep) {
    roundingClasses = 'rounded-lg'
  } else if (isFirstStep) {
    roundingClasses = 'rounded-t-lg'
  } else if (isLastStep) {
    roundingClasses = 'rounded-b-lg'
  }

  switch (status) {
    case 'loading':
      return cn(
        baseClasses,
        roundingClasses,
        'bg-white dark:bg-zinc-800',
        'border-neutral-200 dark:border-neutral-700'
      )
    case 'completed':
      return cn(
        baseClasses,
        roundingClasses,
        'bg-white dark:bg-zinc-800',
        'border-neutral-200 dark:border-neutral-700'
      )
    case 'active':
      return cn(
        baseClasses,
        roundingClasses,
        'bg-white dark:bg-zinc-800',
        'border-neutral-200 dark:border-neutral-700'
      )
    default:
      return cn(
        baseClasses,
        roundingClasses,
        'bg-neutral-50 dark:bg-zinc-900',
        'border-neutral-200 dark:border-neutral-700'
      )
  }
}

const getIconClasses = (stepIndex: number) => {
  const status = getStepStatus(stepIndex)

  switch (status) {
    case 'loading':
      return 'text-primary'
    case 'completed':
      return 'text-white bg-green-600 rounded-full p-0.5 stroke-[3]'
    case 'active':
      return 'text-amber-600'
    default:
      return 'text-zinc-400 dark:text-zinc-600'
  }
}

const getTextClasses = (stepIndex: number) => {
  const status = getStepStatus(stepIndex)

  switch (status) {
    case 'loading':
      return 'text-zinc-900 dark:text-zinc-100'
    case 'completed':
      return 'text-zinc-700 dark:text-zinc-300'
    case 'active':
      return 'text-zinc-900 dark:text-zinc-100'
    default:
      return 'text-zinc-500 dark:text-zinc-500'
  }
}

const hasSlotContent = (stepIndex: number) => {
  return !!slots[`step-content-${stepIndex}`]
}

const hasFooterSlot = (stepIndex: number) => {
  return !!slots[`step-footer-${stepIndex}`]
}

const slots = defineSlots<{
  [key: `step-content-${number}`]: () => any
  [key: `step-footer-${number}`]: () => any
}>()
</script>

<template>
  <div :class="['flex flex-col items-center w-full mx-auto py-6', maxWidth]">
    <div
      v-for="(step, index) in steps"
      :key="step.id"
      :class="getStepClasses(index)"
      class="w-full"
    >
      <!-- Clickable Header -->
      <DsProgressStepsHeader
        :icon="getStepIcon(index)"
        :icon-classes="getIconClasses(index)"
        :title="step.title"
        :description="step.description"
        :text-classes="getTextClasses(index)"
        :is-expanded="isExpanded(index)"
        :can-toggle="canToggleStep(index)"
        :is-process-complete="isProcessComplete"
        @toggle="toggleStep(index)"
      />

      <!-- Collapsible Step Content -->
      <div
        v-if="isExpanded(index) && (hasSlotContent(index) || hasFooterSlot(index))"
        class="overflow-hidden"
      >
        <div v-if="hasSlotContent(index)" class="p-6 pt-4">
          <slot :name="`step-content-${index}`" />
        </div>

        <!-- Custom footer slot (renders outside padded content) -->
        <slot v-if="hasFooterSlot(index)" :name="`step-footer-${index}`" />

        <!-- Built-in footer (only show when not hidden) -->
        <DsProgressStepsFooter
          v-if="index === currentStep && !hideFooter"
          :show-back-button="showBackButton"
          :back-button-text="backButtonText"
          :next-button-text="nextButtonText"
          :is-next-disabled="isNextDisabled"
          :is-process-complete="isProcessComplete"
          @back="emit('back')"
          @next="emit('next')"
        />
      </div>
    </div>
  </div>
</template>
