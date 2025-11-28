<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMcpToolsStore } from '@/stores/mcpToolsStore'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Chart } from '@/components/ui/chart'
import { AlertCircle, Package, Wrench, Coins } from 'lucide-vue-next'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'
import type { McpInstallation } from '@/types/mcp-installations'

// Register ECharts components for pie chart
use([TooltipComponent, LegendComponent, PieChart, CanvasRenderer])

interface Props {
  installation: McpInstallation
  teamId: string
}

const props = defineProps<Props>()
const { t } = useI18n()
const mcpToolsStore = useMcpToolsStore()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tools = ref<any>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

// Format token count with commas
const formatTokenCount = (count: number) => {
  return count.toLocaleString()
}

// Load tools on component mount
onMounted(async () => {
  await loadTools()
})

async function loadTools() {
  isLoading.value = true
  error.value = null

  try {
    tools.value = await mcpToolsStore.fetchInstallationTools(props.teamId, props.installation.id)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error occurred'
  } finally {
    isLoading.value = false
  }
}

// Check if we have tools
const hasTools = computed(() => {
  return tools.value && tools.value.tools && tools.value.tools.length > 0
})

// Pie chart configuration for token distribution
const pieChartOption = computed<EChartsOption>(() => {
  if (!hasTools.value) return {}

  const pieData = tools.value.tools.map((tool: { tool_name: string; token_count: number }) => ({
    name: tool.tool_name,
    value: tool.token_count
  }))

  return {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} tokens ({d}%)'
    },
    legend: {
      show: false
    },
    series: [
      {
        name: 'Token Distribution',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          formatter: '{b}',
          fontSize: 11
        },
        labelLine: {
          show: true
        },
        data: pieData
      }
    ]
  }
})
</script>

<template>
  <div>
    <!-- Loading State -->
    <div v-if="isLoading" class="text-muted-foreground">
      {{ t('mcpInstallations.details.mcpTools.loading') }}
    </div>

    <!-- Error State -->
    <Alert v-else-if="error" variant="destructive" class="mb-6">
      <AlertCircle class="h-4 w-4" />
      <AlertDescription>
        {{ t('mcpInstallations.details.mcpTools.error.description', { error }) }}
      </AlertDescription>
    </Alert>

    <!-- No Tools State -->
    <div v-else-if="!hasTools" class="text-center py-12">
      <Package class="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-semibold">{{ t('mcpInstallations.details.mcpTools.noTools.title') }}</h3>
      <p class="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        {{ t('mcpInstallations.details.mcpTools.noTools.description') }}
      </p>
    </div>

    <!-- Tools Display -->
    <div v-else class="space-y-6">
      <!-- Summary Cards with Pie Chart -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Left: Stats with Icons -->
        <div class="bg-white dark:bg-card border rounded-lg p-6 space-y-6">
          <div class="flex items-center gap-4">
            <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
              <Wrench class="h-6 w-6 text-teal-700 dark:text-teal-400" />
            </div>
            <div>
              <div class="text-sm text-muted-foreground">{{ t('mcpInstallations.details.mcpTools.summary.totalTools') }}</div>
              <div class="text-2xl font-bold">{{ tools.tool_count }}</div>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Coins class="h-6 w-6 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <div class="text-sm text-muted-foreground">{{ t('mcpInstallations.details.mcpTools.summary.totalTokens') }}</div>
              <div class="text-2xl font-bold">{{ formatTokenCount(tools.total_tokens) }}</div>
            </div>
          </div>
        </div>

        <!-- Right: Pie Chart for Token Distribution -->
        <div class="bg-white dark:bg-card border rounded-lg p-4">
          <div class="text-sm font-medium mb-2">Token Distribution</div>
          <Chart
            :option="pieChartOption"
            variant="pie"
            size="sm"
          />
        </div>
      </div>

      <!-- Tools Table -->
      <div class="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{{ t('mcpInstallations.details.mcpTools.table.columns.toolName') }}</TableHead>
              <TableHead>{{ t('mcpInstallations.details.mcpTools.table.columns.description') }}</TableHead>
              <TableHead class="text-right">{{ t('mcpInstallations.details.mcpTools.table.columns.tokenCount') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="tool in tools.tools" :key="tool.id">
              <TableCell class="text-sm font-medium align-top whitespace-nowrap">{{ tool.tool_name }}</TableCell>
              <TableCell class="text-sm text-muted-foreground max-w-2xl">
                <div class="whitespace-normal wrap-break-word">
                  {{ tool.description || t('mcpInstallations.details.mcpTools.table.values.noDescription') }}
                </div>
              </TableCell>
              <TableCell class="text-right align-top whitespace-nowrap text-sm font-medium">
                {{ formatTokenCount(tool.token_count) }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  </div>
</template>
