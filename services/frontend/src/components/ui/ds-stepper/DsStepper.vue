<script setup lang="ts">
import { cn } from '@/lib/utils'
import { CircleCheck, CircleDashed } from 'lucide-vue-next'

export interface WizardStep {
  id: string
  label: string
  status: 'completed' | 'current' | 'pending'
}

interface Props {
  steps: WizardStep[]
  interactive?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  interactive: false
})

const emit = defineEmits<{
  stepClick: [step: WizardStep, index: number]
}>()

function handleStepClick(step: WizardStep, index: number) {
  if (props.interactive && step.status === 'completed') {
    emit('stepClick', step, index)
  }
}

function isClickable(step: WizardStep): boolean {
  return props.interactive && step.status === 'completed'
}
</script>

<template>
  <nav aria-label="Progress" class="w-56 shrink-0">
    <ol class="space-y-1">
      <li v-for="(step, index) in steps" :key="step.id">
        <button
          type="button"
          :disabled="!isClickable(step)"
          :class="cn(
            'flex items-center gap-3 w-full text-left rounded-md px-3 py-2 transition-colors',
            isClickable(step) && 'cursor-pointer hover:bg-neutral-100',
            !isClickable(step) && 'cursor-default'
          )"
          @click="handleStepClick(step, index)"
        >
          <!-- Step icon -->
          <CircleCheck
            v-if="step.status === 'completed'"
            class="h-5 w-5 shrink-0 text-green-600"
          />
          <CircleDashed
            v-else-if="step.status === 'current'"
            class="h-5 w-5 shrink-0 text-primary"
          />
          <CircleDashed
            v-else
            class="h-5 w-5 shrink-0 text-neutral-400"
          />

          <!-- Label -->
          <span
            :class="cn(
              'text-sm font-medium transition-colors',
              step.status === 'completed' && 'text-muted-foreground',
              step.status === 'current' && 'text-foreground',
              step.status === 'pending' && 'text-neutral-400'
            )"
          >
            {{ step.label }}
          </span>
        </button>
      </li>
    </ol>
  </nav>
</template>
