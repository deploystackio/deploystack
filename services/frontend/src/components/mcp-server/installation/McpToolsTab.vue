<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMcpToolsStore } from '@/stores/mcpToolsStore'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Package } from 'lucide-vue-next'
import type { McpInstallation } from '@/types/mcp-installations'

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
      <!-- Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-muted/50 rounded-lg p-4">
          <div class="text-sm text-muted-foreground">{{ t('mcpInstallations.details.mcpTools.summary.totalTools') }}</div>
          <div class="text-2xl font-bold mt-1">{{ tools.tool_count }}</div>
        </div>
        <div class="bg-muted/50 rounded-lg p-4">
          <div class="text-sm text-muted-foreground">{{ t('mcpInstallations.details.mcpTools.summary.totalTokens') }}</div>
          <div class="text-2xl font-bold mt-1">{{ formatTokenCount(tools.total_tokens) }}</div>
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
              <TableCell class="font-mono text-sm align-top whitespace-nowrap">{{ tool.tool_name }}</TableCell>
              <TableCell class="text-sm text-muted-foreground max-w-2xl">
                <div class="whitespace-normal break-words">
                  {{ tool.description || t('mcpInstallations.details.mcpTools.table.values.noDescription') }}
                </div>
              </TableCell>
              <TableCell class="text-right align-top whitespace-nowrap">
                <Badge variant="outline">{{ formatTokenCount(tool.token_count) }}</Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  </div>
</template>
