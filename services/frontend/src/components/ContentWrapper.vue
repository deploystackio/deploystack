<script setup lang="ts">
import { computed } from 'vue'
import { Card, CardContent } from '@/components/ui/card'

interface Props {
  /** Maximum width of the content container */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /** Enable/disable the gray background wrapper */
  background?: boolean
  /** Vertical padding size */
  padding?: 'sm' | 'md' | 'lg'
  /** Disable the white card wrapper (useful for custom content styling) */
  noCard?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  maxWidth: 'lg',
  background: true,
  padding: 'lg',
  noCard: false
})

// Compute responsive max-width classes
const maxWidthClasses = computed(() => {
  const maxWidthMap = {
    'sm': 'max-w-xl lg:max-w-2xl',
    'md': 'max-w-2xl lg:max-w-3xl', 
    'lg': 'max-w-2xl lg:max-w-4xl',
    'xl': 'max-w-4xl lg:max-w-6xl',
    '2xl': 'max-w-6xl lg:max-w-7xl'
  }
  return maxWidthMap[props.maxWidth]
})

// Compute padding classes
const paddingClasses = computed(() => {
  const paddingMap = {
    'sm': 'py-8',
    'md': 'py-12',
    'lg': 'py-16'
  }
  return paddingMap[props.padding]
})

// Compute container classes
const containerClasses = computed(() => {
  const baseClasses = props.background 
    ? 'bg-muted/50 rounded-lg sm:rounded-lg' 
    : ''
  return baseClasses
})
</script>

<template>
  <div :class="containerClasses">
    <div :class="paddingClasses">
      <div class="mx-auto max-w-7xl sm:px-2 lg:px-8">
        <div :class="['mx-auto px-4 lg:px-0', maxWidthClasses]">
          <!-- White Card wrapper (default) -->
          <Card v-if="!noCard" class="bg-white shadow-sm">
            <CardContent class="p-6">
              <slot />
            </CardContent>
          </Card>
          
          <!-- Direct content (when noCard is true) -->
          <slot v-else />
        </div>
      </div>
    </div>
  </div>
</template>
