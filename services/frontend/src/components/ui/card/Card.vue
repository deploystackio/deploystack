<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const cardVariants = cva(
  'text-card-foreground flex flex-col gap-6 rounded-xl border py-6',
  {
    variants: {
      variant: {
        default: 'bg-card',
        gray: 'bg-zinc-100',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

const props = withDefaults(
  defineProps<{
    variant?: VariantProps<typeof cardVariants>['variant']
    class?: HTMLAttributes['class']
  }>(),
  {
    variant: 'default',
  }
)
</script>

<template>
  <div
    data-slot="card"
    :class="cn(cardVariants({ variant }), props.class)"
  >
    <slot />
  </div>
</template>
