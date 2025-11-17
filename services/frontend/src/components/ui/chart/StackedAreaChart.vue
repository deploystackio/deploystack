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

export interface SeriesData {
  name: string
  data: number[]
  color?: string
}

export interface StackedAreaChartProps extends Omit<ChartProps, 'option' | 'variant'> {
  series: SeriesData[]
  labels: string[]
  showLegend?: boolean
  smooth?: boolean
  formatValue?: (value: number) => string
}

const props = withDefaults(defineProps<StackedAreaChartProps>(), {
  showLegend: true,
  smooth: true,
  formatValue: (value: number) => value.toLocaleString(),
})

const defaultColors = [
  '#0f766e', // teal-700
  '#14b8a6', // teal-500
  '#2dd4bf', // teal-400
  '#5eead4', // teal-300
  '#99f6e4', // teal-200
  '#ccfbf1', // teal-100
  '#f0fdfa', // teal-50
]

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
        color: '#0f766e',
        opacity: 0.5,
      },
    },
    formatter: (params: any) => {
      if (!Array.isArray(params)) return ''

      let result = `<div style="font-weight: 600; margin-bottom: 8px;">${params[0].axisValue}</div>`

      let total = 0
      params.forEach((param: any) => {
        total += param.value
        const color = param.color
        result += `
          <div style="display: flex; align-items: center; margin-bottom: 4px;">
            <span style="display: inline-block; width: 10px; height: 10px; background-color: ${color}; border-radius: 50%; margin-right: 8px;"></span>
            <span style="flex: 1;">${param.seriesName}</span>
            <span style="font-weight: 600; margin-left: 16px;">${props.formatValue(param.value)}</span>
          </div>
        `
      })

      result += `<div style="border-top: 1px solid #e5e7eb; margin-top: 8px; padding-top: 8px; font-weight: 600;">Total: ${props.formatValue(total)}</div>`

      return result
    },
  },
  legend: props.showLegend ? {
    data: props.series.map(s => s.name),
    top: 0,
    textStyle: {
      color: '#6b7280',
      fontSize: 12,
    },
  } : undefined,
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    top: props.showLegend ? '12%' : '10%',
    containLabel: true,
  },
  xAxis: {
    type: 'category',
    data: props.labels,
    boundaryGap: false,
    axisLine: {
      lineStyle: {
        color: '#6b7280',
      },
    },
    axisLabel: {
      color: '#6b7280',
      fontSize: 12,
    },
  },
  yAxis: {
    type: 'value',
    axisLine: {
      lineStyle: {
        color: '#6b7280',
      },
    },
    axisLabel: {
      color: '#6b7280',
      fontSize: 12,
      formatter: (value: number) => props.formatValue(value),
    },
    splitLine: {
      lineStyle: {
        color: '#f3f4f6',
      },
    },
  },
  series: props.series.map((seriesItem, index) => ({
    name: seriesItem.name,
    type: 'line',
    stack: 'total',
    smooth: props.smooth,
    data: seriesItem.data,
    lineStyle: {
      color: seriesItem.color || defaultColors[index % defaultColors.length],
      width: 0,
    },
    itemStyle: {
      color: seriesItem.color || defaultColors[index % defaultColors.length],
    },
    areaStyle: {
      color: seriesItem.color || defaultColors[index % defaultColors.length],
      opacity: 0.7,
    },
    emphasis: {
      focus: 'series',
    },
  })),
}))
</script>

<template>
  <Chart
    :option="chartOption"
    variant="area"
    :size="size"
    :loading="loading"
    :autoresize="autoresize"
    :class="props.class"
  />
</template>
