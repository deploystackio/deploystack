<!--
@component DsProgressStepsHeader
@description Header component for individual progress steps with icon, title, description, and chevron indicator.

@props
- icon: Component to display as step icon
- iconClasses: CSS classes for the icon
- title: Step title text
- description: Optional step description
- textClasses: CSS classes for title text
- isExpanded: Whether the step is currently expanded
- canToggle: Whether the step can be toggled
- isProcessComplete: Whether the entire process is complete (locks interaction)

@events
- toggle: Emitted when header is clicked

@features
- Clickable header with hover states
- Icon status indicator
- Collapsible chevron animation
- Disabled state for non-toggleable steps
-->
<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'
import type { Component } from 'vue'

interface Props {
  icon: Component
  iconClasses: string
  title: string
  description?: string
  textClasses: string
  isExpanded: boolean
  canToggle: boolean
  isProcessComplete?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  toggle: []
}>()
</script>

<template>
  <button
    type="button"
    :class="[
      'w-full p-6 flex items-start gap-3 text-left',
      canToggle ? 'cursor-pointer' : '!cursor-default',
      'focus:outline-none focus-visible:outline-none'
    ]"
    :disabled="!canToggle || isProcessComplete"
    @click="emit('toggle')"
  >
    <!-- Icon -->
    <div class="flex-shrink-0 mt-0.5">
      <component
        :is="icon"
        :class="[
          'h-4 w-4',
          iconClasses
        ]"
      />
    </div>

    <!-- Title and Description -->
    <div class="flex-1 min-w-0">
      <h3
        :class="[
          'text-sm font-medium',
          textClasses
        ]"
      >
        {{ title }}
      </h3>

      <p
        v-if="description && isExpanded"
        class="mt-1 text-sm text-zinc-600 dark:text-zinc-400"
      >
        {{ description }}
      </p>
    </div>

    <!-- Chevron Icon (only show for toggleable steps) -->
    <div v-if="canToggle" class="flex-shrink-0">
      <ChevronDown
        :class="[
          'h-5 w-5 text-zinc-400 transition-transform duration-200',
          isExpanded ? 'transform rotate-180' : ''
        ]"
      />
    </div>
  </button>
</template>
