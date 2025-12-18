<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { useMcpToolsStore } from '@/stores/mcpToolsStore'
import { McpToolsService } from '@/services/mcpToolsService'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Chart } from '@/components/ui/chart'
import { AlertCircle, Package, Wrench, Coins, CircleCheck, CircleMinus } from 'lucide-vue-next'
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
  canEdit?: boolean
  userRole?: 'team_admin' | 'team_user' | null
}

const props = withDefaults(defineProps<Props>(), {
  canEdit: false,
  userRole: null
})
const { t } = useI18n()
const mcpToolsStore = useMcpToolsStore()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tools = ref<any>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const selectedToolIds = ref<string[]>([])
const isBulkToggling = ref(false)

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

// Check if all tools are selected
const allToolsSelected = computed(() => {
  return hasTools.value && selectedToolIds.value.length === tools.value.tools.length
})

// Check if some (but not all) tools are selected
const someToolsSelected = computed(() => {
  return selectedToolIds.value.length > 0 && !allToolsSelected.value
})

// Toggle all tools selection
const toggleAllTools = () => {
  if (allToolsSelected.value) {
    selectedToolIds.value = []
  } else {
    selectedToolIds.value = tools.value.tools.map((t: { id: string }) => t.id)
  }
}

// Toggle individual tool selection
const toggleToolSelection = (toolId: string) => {
  const index = selectedToolIds.value.indexOf(toolId)
  if (index > -1) {
    selectedToolIds.value.splice(index, 1)
  } else {
    selectedToolIds.value.push(toolId)
  }
}

// Check if tool is selected
const isToolSelected = (toolId: string) => {
  return selectedToolIds.value.includes(toolId)
}

// Handle bulk enable
async function handleBulkEnable() {
  if (selectedToolIds.value.length === 0) return
  await handleBulkToggle(false) // false = enabled
}

// Handle bulk disable
async function handleBulkDisable() {
  if (selectedToolIds.value.length === 0) return
  await handleBulkToggle(true) // true = disabled
}

// Batch toggle selected tools
async function handleBulkToggle(isDisabled: boolean) {
  if (!props.canEdit || selectedToolIds.value.length === 0) return

  isBulkToggling.value = true

  // Prepare batch request
  const toolsToToggle = selectedToolIds.value.map(toolId => ({
    tool_id: toolId,
    is_disabled: isDisabled
  }))

  // Optimistic update
  const originalTools = JSON.parse(JSON.stringify(tools.value.tools))
  selectedToolIds.value.forEach(toolId => {
    const tool = tools.value.tools.find((t: { id: string }) => t.id === toolId)
    if (tool) {
      tool.is_disabled = isDisabled
    }
  })

  try {
    const response = await McpToolsService.batchToggleTools(
      props.teamId,
      props.installation.id,
      toolsToToggle
    )

    const action = isDisabled
      ? t('mcpInstallations.details.tools.toggle.disabled')
      : t('mcpInstallations.details.tools.toggle.enabled')

    // Show success toast
    if (response.total_failed === 0) {
      toast.success(
        t('mcpInstallations.details.tools.bulkToggle.allSuccess', {
          count: response.total_succeeded,
          action
        })
      )
    } else if (response.total_succeeded > 0) {
      toast.warning(
        t('mcpInstallations.details.tools.bulkToggle.partialSuccess', {
          succeeded: response.total_succeeded,
          failed: response.total_failed,
          action
        })
      )
    }

    // Clear selection (optimistic update already applied)
    selectedToolIds.value = []

  } catch (err) {
    // Revert optimistic update on error
    tools.value.tools = originalTools

    const errorMessage = err instanceof Error ? err.message : t('mcpInstallations.details.tools.toggle.error')
    toast.error(t('mcpInstallations.details.tools.bulkToggle.errorTitle'), {
      description: errorMessage
    })
  } finally {
    isBulkToggling.value = false
  }
}

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
  <div v-if="!isLoading">
    <!-- Error State -->
    <Alert v-if="error" variant="destructive" class="mb-6">
      <AlertCircle class="h-4 w-4" />
      <AlertDescription>
        {{ t('mcpInstallations.details.tools.error.description', { error }) }}
      </AlertDescription>
    </Alert>

    <!-- No Tools State -->
    <div v-else-if="!hasTools" class="text-center py-12">
      <Package class="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-semibold">{{ t('mcpInstallations.details.tools.noTools.title') }}</h3>
      <p class="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        {{ t('mcpInstallations.details.tools.noTools.description') }}
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
              <div class="text-sm text-muted-foreground">{{ t('mcpInstallations.details.tools.summary.totalTools') }}</div>
              <div class="text-2xl font-bold">{{ tools.tool_count }}</div>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Coins class="h-6 w-6 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <div class="text-sm text-muted-foreground">{{ t('mcpInstallations.details.tools.summary.totalTokens') }}</div>
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

      <!-- Bulk Actions -->
      <div class="flex items-center justify-end gap-2 mb-4">
        <ButtonGroup aria-label="Bulk tool actions">
          <Button
            variant="outline"
            class="w-24"
            :disabled="!props.canEdit || selectedToolIds.length === 0 || isBulkToggling"
            @click="handleBulkEnable"
          >
            <Spinner v-if="isBulkToggling" />
            <span v-else>{{ t('mcpInstallations.details.tools.bulkActions.enable') }}</span>
          </Button>
          <Button
            variant="outline"
            class="w-24"
            :disabled="!props.canEdit || selectedToolIds.length === 0 || isBulkToggling"
            @click="handleBulkDisable"
          >
            <Spinner v-if="isBulkToggling" />
            <span v-else>{{ t('mcpInstallations.details.tools.bulkActions.disable') }}</span>
          </Button>
        </ButtonGroup>
      </div>

      <!-- Tools Table -->
      <div class="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-12">
                <Checkbox
                  :checked="allToolsSelected"
                  :indeterminate="someToolsSelected"
                  :disabled="!props.canEdit"
                  @update:checked="toggleAllTools"
                />
              </TableHead>
              <TableHead>{{ t('mcpInstallations.details.tools.table.columns.status') }}</TableHead>
              <TableHead>{{ t('mcpInstallations.details.tools.table.columns.toolName') }}</TableHead>
              <TableHead>{{ t('mcpInstallations.details.tools.table.columns.description') }}</TableHead>
              <TableHead class="text-right">{{ t('mcpInstallations.details.tools.table.columns.tokenCount') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="tool in tools.tools" :key="tool.id">
              <TableCell>
                <Checkbox
                  :checked="isToolSelected(tool.id)"
                  :disabled="!props.canEdit"
                  @update:checked="() => toggleToolSelection(tool.id)"
                />
              </TableCell>
              <TableCell>
                <div
                  class="inline-flex items-center justify-center rounded-full border px-1.5 py-0.5 text-xs font-medium text-muted-foreground gap-1"
                >
                  <CircleCheck
                    v-if="!tool.is_disabled"
                    class="size-3 fill-green-500 text-green-500 dark:fill-green-400 dark:text-green-400"
                  />
                  <CircleMinus
                    v-else
                    class="size-3 text-muted-foreground"
                  />
                  <span>
                    {{ tool.is_disabled
                      ? t('mcpInstallations.details.tools.table.values.disabled')
                      : t('mcpInstallations.details.tools.table.values.enabled')
                    }}
                  </span>
                </div>
              </TableCell>
              <TableCell class="text-sm font-medium">{{ tool.tool_name }}</TableCell>
              <TableCell class="text-sm text-muted-foreground max-w-2xl">
                <div class="whitespace-normal wrap-break-word">
                  {{ tool.description || t('mcpInstallations.details.tools.table.values.noDescription') }}
                </div>
              </TableCell>
              <TableCell class="text-right whitespace-nowrap text-sm font-medium">
                {{ formatTokenCount(tool.token_count) }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <!-- Selection Counter (outside table, matching catalog layout) -->
      <div class="flex items-center justify-between px-4 py-4">
        <div class="flex-1 text-sm text-muted-foreground">
          {{ t('mcpInstallations.details.tools.selection.rowsSelected', {
            selected: selectedToolIds.length,
            total: tools.tools.length
          }) }}
        </div>
      </div>
    </div>
  </div>
</template>
