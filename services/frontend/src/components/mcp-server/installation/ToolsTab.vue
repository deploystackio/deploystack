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
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { AlertCircle, Package, CircleCheck, CircleMinus, ChevronRight, ChevronDown } from 'lucide-vue-next'
import type { McpInstallation } from '@/types/mcp-installations'
import ToolsMetricsPanel from './ToolsMetricsPanel.vue'
import { CodeHighlight } from '@/components/ui/code-highlight'

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

// Track expanded rows
const expandedRows = ref<Set<string>>(new Set())

// Toggle row expansion
const toggleRow = (toolId: string) => {
  if (expandedRows.value.has(toolId)) {
    expandedRows.value.delete(toolId)
  } else {
    expandedRows.value.add(toolId)
  }
}

// Format token count with commas
const formatTokenCount = (count: number) => {
  return count.toLocaleString()
}

// Calculate percentage of total tokens
const calculateTokenPercentage = (tokenCount: number) => {
  if (!tools.value || !tools.value.total_tokens || tools.value.total_tokens === 0) {
    return '0.0%'
  }
  const percentage = (tokenCount / tools.value.total_tokens) * 100
  return `${percentage.toFixed(1)}%`
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

// Count enabled and disabled tools
const enabledToolsCount = computed(() => {
  if (!hasTools.value) return 0
  return tools.value.tools.filter((t: { is_disabled: boolean }) => !t.is_disabled).length
})

const disabledToolsCount = computed(() => {
  if (!hasTools.value) return 0
  return tools.value.tools.filter((t: { is_disabled: boolean }) => t.is_disabled).length
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
    <Empty v-else-if="!hasTools">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Package />
        </EmptyMedia>
        <EmptyTitle>{{ t('mcpInstallations.details.tools.noTools.title') }}</EmptyTitle>
        <EmptyDescription>
          {{ t('mcpInstallations.details.tools.noTools.description') }}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>

    <!-- Tools Display -->
    <div v-else class="space-y-6">
      <!-- Metrics Panel -->
      <ToolsMetricsPanel
        :tool-count="tools.tool_count"
        :total-tokens="tools.total_tokens"
        :enabled-count="enabledToolsCount"
        :disabled-count="disabledToolsCount"
      />

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
              <TableHead class="w-12"></TableHead>
              <TableHead>{{ t('mcpInstallations.details.tools.table.columns.status') }}</TableHead>
              <TableHead>{{ t('mcpInstallations.details.tools.table.columns.toolName') }}</TableHead>
              <TableHead class="w-96">{{ t('mcpInstallations.details.tools.table.columns.description') }}</TableHead>
              <TableHead class="text-right">{{ t('mcpInstallations.details.tools.table.columns.tokenCount') }}</TableHead>
              <TableHead class="text-right">{{ t('mcpInstallations.details.tools.table.columns.distribution') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-for="tool in tools.tools" :key="tool.id">
              <!-- Main Tool Row (clickable) -->
              <TableRow
                class="cursor-pointer hover:bg-muted/50"
                @click.stop="toggleRow(tool.id)"
              >
                <TableCell @click.stop>
                  <Checkbox
                    :checked="isToolSelected(tool.id)"
                    :disabled="!props.canEdit"
                    @update:checked="() => toggleToolSelection(tool.id)"
                  />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" class="h-6 w-6">
                    <ChevronRight v-if="!expandedRows.has(tool.id)" class="h-4 w-4" />
                    <ChevronDown v-else class="h-4 w-4" />
                  </Button>
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
                <TableCell class="text-sm text-muted-foreground w-96">
                  <div class="truncate">
                    {{ tool.description || t('mcpInstallations.details.tools.table.values.noDescription') }}
                  </div>
                </TableCell>
                <TableCell class="text-right whitespace-nowrap text-sm font-medium">
                  {{ formatTokenCount(tool.token_count) }}
                </TableCell>
                <TableCell class="text-right whitespace-nowrap text-sm text-muted-foreground">
                  {{ calculateTokenPercentage(tool.token_count) }}
                </TableCell>
              </TableRow>

              <!-- Expanded Detail Row -->
              <TableRow v-if="expandedRows.has(tool.id)" class="bg-muted/30">
                <TableCell colspan="7" class="p-6">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Left: Full Description -->
                    <div>
                      <h4 class="text-sm font-semibold mb-2">{{ t('mcpInstallations.details.tools.detail.description') }}</h4>
                      <p class="text-sm text-muted-foreground">
                        {{ tool.description || t('mcpInstallations.details.tools.table.values.noDescription') }}
                      </p>
                    </div>

                    <!-- Right: Input Schema -->
                    <div>
                      <h4 class="text-sm font-semibold mb-2">{{ t('mcpInstallations.details.tools.detail.inputSchema') }}</h4>
                      <CodeHighlight
                        :code="JSON.stringify(tool.input_schema, null, 2)"
                        language="json"
                      />
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            </template>
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
