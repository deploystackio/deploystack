<script setup lang="ts">
import { computed } from 'vue'
import { use } from 'echarts/core'
import { LineChart as EChartsLineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import Chart, { type ChartProps } from './Chart.vue'
import type { EChartsOption } from 'echarts'

use([
  GridComponent,
  TooltipComponent,
  LegendComponent,
  EChartsLineChart,
  CanvasRenderer,
])

export interface LineChartProps extends Omit<ChartProps, 'option' | 'variant'> {
  data: number[]
  labels: string[]
  name?: string
  smooth?: boolean
  showArea?: boolean
  showSymbol?: boolean
  showAxis?: boolean
  color?: string
  areaColor?: string
}

const props = withDefaults(defineProps<LineChartProps>(), {
  name: 'Data',
  smooth: true,
  showArea: true,
  showSymbol: true,
  showAxis: true,
  color: '#0f766e',
  areaColor: 'rgba(15, 118, 110, 0.3)',
})

const chartOption = computed<EChartsOption>(() => ({
  tooltip: {
    trigger: 'axis',
    backgroundColor: 'white',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    textStyle: {
      color: '#374151',
    },
    axisPointer: {
      type: 'line',
      lineStyle: {
        color: props.color,
        opacity: 0.5,
      },
    },
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    top: '10%',
  },
  xAxis: {
    type: 'category',
    data: props.labels,
    boundaryGap: false,
    axisLine: {
      show: props.showAxis,
      lineStyle: {
        color: '#6b7280',
      },
    },
    axisLabel: {
      show: props.showAxis,
      color: '#6b7280',
      fontSize: 12,
    },
  },
  yAxis: {
    type: 'value',
    axisLine: {
      show: props.showAxis,
      lineStyle: {
        color: '#6b7280',
      },
    },
    axisLabel: {
      show: props.showAxis,
      color: '#6b7280',
      fontSize: 12,
    },
    splitLine: {
      show: props.showAxis,
      lineStyle: {
        color: '#f3f4f6',
      },
    },
  },
  series: [
    {
      name: props.name,
      type: 'line',
      smooth: props.smooth,
      showSymbol: props.showSymbol,
      data: props.data,
      lineStyle: {
        color: props.color,
        width: 2,
      },
      itemStyle: {
        color: props.color,
      },
      ...(props.showArea && {
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              {
                offset: 0,
                color: props.areaColor,
              },
              {
                offset: 1,
                color: 'rgba(15, 118, 110, 0)',
              },
            ],
          },
        },
      }),
      emphasis: {
        focus: 'series',
      },
    },
  ],
}))
</script>

<template>
  <Chart 
    :option="chartOption" 
    variant="line"
    :size="size"
    :loading="loading"
    :autoresize="autoresize"
    :class="props.class"
  />
</template>
