<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import type { EChartsOption } from 'echarts'

const chartVariants = cva(
  'w-full',
  {
    variants: {
      variant: {
        line: '',
        area: '',
        bar: '',
        pie: '',
      },
      size: {
        sm: 'h-[200px]',
        md: 'h-[300px]',
        lg: 'h-[400px]',
        xl: 'h-[500px]',
      },
    },
    defaultVariants: {
      variant: 'line',
      size: 'md',
    },
  }
)

export interface ChartProps {
  option: EChartsOption
  variant?: VariantProps<typeof chartVariants>['variant']
  size?: VariantProps<typeof chartVariants>['size']
  loading?: boolean
  autoresize?: boolean
  class?: string
}

const props = withDefaults(defineProps<ChartProps>(), {
  variant: 'line',
  size: 'md',
  loading: false,
  autoresize: true,
})
</script>

<template>
  <div :class="cn(chartVariants({ variant, size }), props.class)">
    <VChart 
      :option="option" 
      :autoresize="autoresize"
      :loading="loading"
      class="h-full w-full"
    />
  </div>
</template>
