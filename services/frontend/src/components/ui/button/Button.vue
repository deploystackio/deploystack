<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { Primitive, type PrimitiveProps } from 'reka-ui'
import { Loader2 } from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import { type ButtonVariants, buttonVariants } from '.'

interface Props extends PrimitiveProps {
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  class?: HTMLAttributes['class']
  loading?: boolean
  loadingText?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  as: 'button',
  loading: false,
  disabled: false,
})

// Compute the actual disabled state (disabled when loading or explicitly disabled)
const isDisabled = computed(() => props.loading || props.disabled)

// Compute icon size based on button size
const spinnerSize = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'h-3 w-3'
    case 'lg':
      return 'h-5 w-5'
    default:
      return 'h-4 w-4'
  }
})
</script>

<template>
  <Primitive
    data-slot="button"
    :as="as"
    :as-child="asChild"
    :class="cn(buttonVariants({ variant, size }), props.class)"
    :disabled="isDisabled"
  >
    <Loader2
      v-if="loading"
      :class="cn(spinnerSize, 'animate-spin')"
    />
    <template v-if="loading && loadingText">
      {{ loadingText }}
    </template>
    <slot v-else-if="!loading" />
  </Primitive>
</template>
