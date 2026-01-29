<!--
@component DsProgressStepsFooter
@description Footer component for progress steps with Back and Next navigation buttons. Matches DsCard footer design.

@props
- showBackButton: Whether to show the back button (default: false)
- backButtonText: Text for the back button (default: 'Back')
- backButtonTo: Router link object for back button navigation (optional, replaces click handler)
- nextButtonText: Text for the next button (default: 'Next')
- isNextDisabled: Whether the next button is disabled (default: false)
- isNextLoading: Whether the next button is in loading state (default: false)
- nextLoadingText: Text to show when next button is loading (optional)
- nextButtonVariant: Variant for the next button (default: 'default')
- nextButtonClass: Additional classes for the next button
- isProcessComplete: Whether the process is complete (hides footer)

@events
- back: Emitted when back button is clicked (not emitted if backButtonTo is provided)
- next: Emitted when next button is clicked

@features
- Matches DsCard footer design (gray background, top border)
- Responsive button layout with space-between
- Back button is outline variant, Next is customizable variant
- Can hide back button while maintaining layout
- Loading state support for next button
- Back button can be a router-link or emit a click event
-->
<script setup lang="ts">
import { Button } from '@/components/ui/button'
import type { RouteLocationRaw } from 'vue-router'

interface Props {
  showBackButton?: boolean
  backButtonText?: string
  backButtonTo?: RouteLocationRaw
  nextButtonText?: string
  isNextDisabled?: boolean
  isNextLoading?: boolean
  nextLoadingText?: string
  nextButtonVariant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  nextButtonClass?: string
  isProcessComplete?: boolean
}

withDefaults(defineProps<Props>(), {
  showBackButton: false,
  backButtonText: 'Back',
  nextButtonText: 'Next',
  isNextDisabled: false,
  isNextLoading: false,
  nextButtonVariant: 'default',
  isProcessComplete: false
})

const emit = defineEmits<{
  back: []
  next: []
}>()
</script>

<template>
  <footer
    v-if="!isProcessComplete"
    class="flex items-center justify-between gap-4 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-6 py-4"
  >
    <div v-if="showBackButton">
      <!-- Back button as router-link if backButtonTo is provided -->
      <Button
        v-if="backButtonTo"
        variant="outline"
        as-child
      >
        <router-link :to="backButtonTo">
          {{ backButtonText }}
        </router-link>
      </Button>
      <!-- Back button with click handler if backButtonTo is not provided -->
      <Button
        v-else
        variant="outline"
        @click="emit('back')"
      >
        {{ backButtonText }}
      </Button>
    </div>
    <div v-else />

    <div class="flex items-center gap-2">
      <Button
        :variant="nextButtonVariant"
        :disabled="isNextDisabled"
        :loading="isNextLoading"
        :loading-text="nextLoadingText"
        :class="nextButtonClass"
        @click="emit('next')"
      >
        {{ nextButtonText }}
      </Button>
    </div>
  </footer>
</template>
