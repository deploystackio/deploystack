<!--
@component ProgressBars
@description A multi-step progress indicator component that shows current progress through a series of steps with labels and completion states.

@example
<ProgressBars
  :steps="[
    { id: 'copy', label: 'Copying files', status: 'completed' },
    { id: 'migrate', label: 'Migrating database', status: 'current' },
    { id: 'compile', label: 'Compiling assets', status: 'pending' },
    { id: 'deploy', label: 'Deployed', status: 'pending' }
  ]"
  :progress="37.5"
  title="Migrating MySQL database..."
  variant="default"
/>

@props
- steps: Array of step objects with id, label, and status
- progress: Current progress percentage (0-100)
- title: Main title/description of the process
- variant: Visual style variant ('default' | 'success' | 'warning' | 'destructive')
- size: Size variant ('sm' | 'md' | 'lg')
- showSteps: Whether to show step labels below progress bar
- hideTitle: Whether to hide the title (for screen readers only)

@emits
- stepClick: Emitted when a step is clicked (if interactive)

@accessibility
- Uses proper ARIA attributes for progress indication
- Screen reader friendly with sr-only labels
- Supports keyboard navigation for interactive steps
-->

<script setup lang="ts">
import { computed } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import Card from '@/components/ui/card/Card.vue'

export interface ProgressStep {
  id: string
  label: string
  status: 'completed' | 'current' | 'pending' | 'error'
  clickable?: boolean
}

const progressBarsVariants = cva(
  'w-full',
  {
    variants: {
      variant: {
        default: '',
        success: '',
        warning: '',
        destructive: ''
      },
      size: {
        sm: '',
        md: '',
        lg: ''
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md'
    }
  }
)

const progressBarVariants = cva(
  'overflow-hidden rounded-full transition-all duration-300 ease-in-out',
  {
    variants: {
      variant: {
        default: 'bg-gray-200',
        success: 'bg-green-100',
        warning: 'bg-yellow-100',
        destructive: 'bg-red-100'
      },
      size: {
        sm: 'h-1',
        md: 'h-2',
        lg: 'h-3'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md'
    }
  }
)

const progressFillVariants = cva(
  'h-full rounded-full transition-all duration-500 ease-out',
  {
    variants: {
      variant: {
        default: 'bg-primary',
        success: 'bg-green-600',
        warning: 'bg-yellow-600',
        destructive: 'bg-destructive'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

interface Props {
  steps: ProgressStep[]
  progress: number
  title?: string
  variant?: VariantProps<typeof progressBarsVariants>['variant']
  size?: VariantProps<typeof progressBarsVariants>['size']
  showSteps?: boolean
  hideTitle?: boolean
  interactive?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  variant: 'default',
  size: 'md',
  showSteps: true,
  hideTitle: false,
  interactive: false
})

const emit = defineEmits<{
  stepClick: [step: ProgressStep, index: number]
}>()

const stepVariants = cva(
  'text-sm font-medium transition-colors duration-200',
  {
    variants: {
      status: {
        completed: 'text-primary',
        current: 'text-primary',
        pending: 'text-gray-600',
        error: 'text-destructive'
      },
      clickable: {
        true: 'cursor-pointer hover:text-primary/80',
        false: ''
      }
    },
    defaultVariants: {
      status: 'pending',
      clickable: false
    }
  }
)

const clampedProgress = computed(() => Math.max(0, Math.min(100, props.progress)))

// Calculate the exact position percentage for each step with padding
function getStepPosition(index: number) {
  const totalSteps = props.steps.length
  if (totalSteps <= 1) return 50

  const padding = 3 // 3% padding on each side
  const availableWidth = 100 - (padding * 2)
  const position = padding + (index / (totalSteps - 1)) * availableWidth

  return position
}

function handleStepClick(step: ProgressStep, index: number) {
  if (props.interactive && step.clickable) {
    emit('stepClick', step, index)
  }
}

// Get transform style to center text on the exact position
function getStepTransform(index: number) {
  const position = getStepPosition(index)

  // Adjust transform to center the text on the position
  if (position === 0) return 'translateX(0%)' // First step: no adjustment needed
  if (position === 100) return 'translateX(-100%)' // Last step: move completely left
  return 'translateX(-50%)' // Middle steps: center on position
}
</script>

<template>
  <Card variant="white">
    <div class="px-6">
      <div :class="cn(progressBarsVariants({ variant, size }))">
        <!-- Title -->
        <div v-if="title" class="mb-4">
          <h4 v-if="hideTitle" class="sr-only">{{ title }}</h4>
          <p v-else class="text-sm font-medium text-foreground">{{ title }}</p>
        </div>

        <!-- Progress Bar -->
        <div class="mt-6">
          <div class="relative">
            <div
              role="progressbar"
              :aria-valuenow="clampedProgress"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-label="title || 'Progress'"
              :class="cn(progressBarVariants({ variant, size }))"
            >
              <div
                :class="cn(progressFillVariants({ variant }))"
                :style="{ width: `${clampedProgress}%` }"
              />
            </div>

            <!-- Step boxes overlaid on progress bar -->
            <div
              v-if="showSteps && steps.length > 0"
              class="hidden sm:block absolute inset-0 pointer-events-none"
            >
              <div
                v-for="(step, index) in steps"
                :key="step.id"
                class="absolute top-1/2"
                :style="{
                  left: `${getStepPosition(index)}%`,
                  transform: `translate(-50%, calc(-50% + 1px))`
                }"
              >
                <button
                  :type="interactive && step.clickable ? 'button' : undefined"
                  :disabled="!interactive || !step.clickable"
                  :class="[
                    'bg-white border border-gray-300 rounded px-2 py-1 text-sm font-medium pointer-events-auto',
                    interactive && step.clickable ? 'cursor-pointer hover:bg-gray-50' : ''
                  ]"
                  @click="handleStepClick(step, index)"
                >
                  {{ index + 1 }}
                </button>
              </div>
            </div>
          </div>

          <!-- Step labels below -->
          <div
            v-if="showSteps && steps.length > 0"
            class="hidden sm:block relative w-full mt-2 py-5"
          >
            <div
              v-for="(step, index) in steps"
              :key="`label-${step.id}`"
              :class="[
                cn(stepVariants({
                  status: step.status,
                  clickable: false
                })),
                'absolute text-sm font-medium whitespace-nowrap'
              ]"
              :style="{
                left: `${getStepPosition(index)}%`,
                transform: getStepTransform(index)
              }"
            >
              {{ step.label }}
            </div>
          </div>

          <!-- Mobile Steps (Vertical List) -->
          <div v-if="showSteps && steps.length > 0" class="sm:hidden space-y-2">
            <div
              v-for="(step, index) in steps"
              :key="`mobile-${step.id}`"
              class="flex items-center justify-between"
            >
              <span :class="cn(stepVariants({ status: step.status }))">
                {{ step.label }}
              </span>
              <div class="flex items-center gap-2">
                <!-- Status Icon -->
                <div
                  :class="[
                    'w-2 h-2 rounded-full',
                    step.status === 'completed' ? 'bg-primary' : '',
                    step.status === 'current' ? 'bg-primary animate-pulse' : '',
                    step.status === 'pending' ? 'bg-red-500' : '',
                    step.status === 'error' ? 'bg-destructive' : ''
                  ]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Card>
</template>
