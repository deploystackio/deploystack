<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { DsPageHeading } from '@/components/ui/ds-page-heading'
import { useEventBus } from '@/composables/useEventBus'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { useMcpToolsStatsStore } from '@/stores/mcpToolsStatsStore'
import McpInstallationsEmptyState from '@/components/mcp-server/McpInstallationsEmptyState.vue'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StackedBarChart } from '@/components/ui/chart'
import {
  TrendingDown,
  Database,
  Layers,
  Zap,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from 'lucide-vue-next'
import type { TeamMcpToolsStats } from '@/types/mcpStats'

const { t } = useI18n()
const router = useRouter()
const eventBus = useEventBus()
const statsStore = useMcpToolsStatsStore()
const { setBreadcrumbs } = useBreadcrumbs()

const stats = ref<TeamMcpToolsStats | null>(null)
const error = ref<string | null>(null)
const expandedRows = ref<Set<string>>(new Set())

// Use ref instead of computed for better reactivity
const teamId = ref<string | null>(null)

// Initialize teamId from storage
const initializeTeamId = () => {
  teamId.value = eventBus.getState<string>('selected_team_id')
}

async function fetchStats() {
  if (!teamId.value) {
    error.value = t('statistics.errors.noTeamSelected')
    return
  }

  error.value = null
  try {
    const response = await statsStore.fetchStats(teamId.value)
    stats.value = response.data
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('statistics.errors.fetchFailed')
  }
}

function toggleRow(installationId: string) {
  if (expandedRows.value.has(installationId)) {
    expandedRows.value.delete(installationId)
  } else {
    expandedRows.value.add(installationId)
  }
}

function formatNumber(value: number): string {
  return value.toLocaleString()
}

function formatTokens(value: number): string {
  return `${value.toLocaleString()} tokens`
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}

function handleInstallServer() {
  router.push('/mcp-server/install')
}

const chartData = computed(() => {
  if (!stats.value) return { series: [], labels: [] }

  const installations = stats.value.installations
  const labels = ['Token Usage Comparison']

  // Traditional: All installations stacked - this creates ONE bar
  const traditionalSeries = installations.map((installation) => ({
    name: installation.installation_name,
    data: [installation.total_tokens],
    stack: 'traditional',
    color: undefined,
  }))

  // Hierarchical: Separate bar next to the traditional bar
  const hierarchicalSeries = [{
    name: 'DeployStack Meta-Tools',
    data: [stats.value.hierarchical_approach.total_tokens],
    stack: undefined, // No stack - this makes it a separate bar
    color: '#10b981', // green-500
  }]

  return {
    series: [...traditionalSeries, ...hierarchicalSeries],
    labels
  }
})

// Event handler for team selection from sidebar
const handleTeamSelected = () => {
  // Update teamId from storage and fetch stats
  teamId.value = eventBus.getState<string>('selected_team_id')
  fetchStats()
}

onMounted(() => {
  setBreadcrumbs([{ label: t('statistics.title') }])

  // Initialize teamId from storage
  initializeTeamId()
  // Fetch initial stats
  fetchStats()

  // Listen for team selection events from sidebar
  eventBus.on('team-selected', handleTeamSelected)
})

onUnmounted(() => {
  // Clean up event listeners
  eventBus.off('team-selected', handleTeamSelected)
})
</script>

<template>
  <NavbarLayout>
    <DsPageHeading :title="t('statistics.title')" />

    <div class="space-y-6 mt-6">
      <!-- Error Alert -->
      <Alert v-if="error" variant="destructive">
        <AlertCircle class="h-4 w-4" />
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <!-- Empty State -->
      <McpInstallationsEmptyState
        v-if="!statsStore.isLoading && !error && stats?.total_installations === 0"
        @install-server="handleInstallServer"
      />

      <!-- Statistics Content -->
      <template v-if="stats && stats.total_installations > 0">
        <!-- Summary Cards -->
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <!-- Total Installations -->
          <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle class="text-sm font-medium">
                {{ t('statistics.cards.installations') }}
              </CardTitle>
              <Database class="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div class="text-2xl font-bold">{{ formatNumber(stats.total_installations) }}</div>
              <p class="text-xs text-muted-foreground">
                {{ t('statistics.cards.mcpServers') }}
              </p>
            </CardContent>
          </Card>

          <!-- Total Tools -->
          <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle class="text-sm font-medium">
                {{ t('statistics.cards.totalTools') }}
              </CardTitle>
              <Layers class="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div class="text-2xl font-bold">{{ formatNumber(stats.total_tools) }}</div>
              <p class="text-xs text-muted-foreground">
                {{ t('statistics.cards.availableTools') }}
              </p>
            </CardContent>
          </Card>

          <!-- Token Savings -->
          <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle class="text-sm font-medium">
                {{ t('statistics.cards.tokenSavings') }}
              </CardTitle>
              <TrendingDown class="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div class="text-2xl font-bold text-green-600">
                {{ formatPercent(stats.savings.reduction_percent) }}
              </div>
              <p class="text-xs text-muted-foreground">
                {{ formatTokens(stats.savings.tokens_saved) }} {{ t('statistics.cards.saved') }}
              </p>
            </CardContent>
          </Card>

          <!-- Context Window Usage (Hierarchical) -->
          <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle class="text-sm font-medium">
                {{ t('statistics.cards.hierarchicalUsage') }}
              </CardTitle>
              <Zap class="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div class="text-2xl font-bold text-green-600">
                {{ formatTokens(stats.hierarchical_approach.total_tokens) }}
              </div>
              <p class="text-xs text-muted-foreground">
                {{ formatPercent(stats.hierarchical_approach.context_window_utilization_percent) }} {{ t('statistics.cards.ofContext') }}
              </p>
            </CardContent>
          </Card>
        </div>

        <!-- Token Comparison Card -->
        <Card>
          <CardHeader>
            <CardTitle>{{ t('statistics.comparison.title') }}</CardTitle>
            <CardDescription>{{ t('statistics.comparison.description') }}</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="grid md:grid-cols-2 gap-6">
              <!-- Traditional Approach -->
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <Badge variant="outline">{{ t('statistics.comparison.traditional') }}</Badge>
                </div>
                <div class="space-y-1">
                  <div class="flex justify-between text-sm">
                    <span class="text-muted-foreground">{{ t('statistics.comparison.totalTools') }}</span>
                    <span class="font-medium">{{ formatNumber(stats.traditional_approach.total_tools) }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-muted-foreground">{{ t('statistics.comparison.tokens') }}</span>
                    <span class="font-medium">{{ formatTokens(stats.traditional_approach.total_tokens) }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-muted-foreground">{{ t('statistics.comparison.contextUsage') }}</span>
                    <span class="font-medium">{{ formatPercent(stats.traditional_approach.context_window_utilization_percent) }}</span>
                  </div>
                </div>
              </div>

              <!-- Hierarchical Approach -->
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <Badge variant="default">{{ t('statistics.comparison.hierarchical') }}</Badge>
                  <Badge variant="outline" class="text-green-600 border-green-600">
                    {{ t('statistics.comparison.deploystack') }}
                  </Badge>
                </div>
                <div class="space-y-1">
                  <div class="flex justify-between text-sm">
                    <span class="text-muted-foreground">{{ t('statistics.comparison.metaTools') }}</span>
                    <span class="font-medium">{{ formatNumber(stats.hierarchical_approach.exposed_tools) }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-muted-foreground">{{ t('statistics.comparison.tokens') }}</span>
                    <span class="font-medium text-green-600">{{ formatTokens(stats.hierarchical_approach.total_tokens) }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-muted-foreground">{{ t('statistics.comparison.contextUsage') }}</span>
                    <span class="font-medium text-green-600">{{ formatPercent(stats.hierarchical_approach.context_window_utilization_percent) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Token Usage Comparison -->
        <Card>
          <CardHeader>
            <CardTitle>{{ t('statistics.breakdown.title') }}</CardTitle>
            <CardDescription>{{ t('statistics.breakdown.description') }}</CardDescription>
          </CardHeader>
          <CardContent>
            <StackedBarChart
              :series="chartData.series"
              :labels="chartData.labels"
              :format-value="formatTokens"
              bar-width="35%"
              size="lg"
              :loading="statsStore.isLoading"
            />
          </CardContent>
        </Card>

        <!-- Installation Breakdown -->
        <Card>
          <CardHeader>
            <CardTitle>{{ t('statistics.installations.title') }}</CardTitle>
            <CardDescription>{{ t('statistics.installations.description') }}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-10"></TableHead>
                  <TableHead>{{ t('statistics.installations.columns.name') }}</TableHead>
                  <TableHead class="text-right">{{ t('statistics.installations.columns.tools') }}</TableHead>
                  <TableHead class="text-right">{{ t('statistics.installations.columns.tokens') }}</TableHead>
                  <TableHead class="text-right">{{ t('statistics.installations.columns.avgPerTool') }}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <template v-for="installation in stats.installations" :key="installation.installation_id">
                  <!-- Installation Row -->
                  <TableRow class="cursor-pointer hover:bg-muted/50" @click="toggleRow(installation.installation_id)">
                    <TableCell>
                      <Button variant="ghost" size="icon" class="h-6 w-6">
                        <ChevronRight v-if="!expandedRows.has(installation.installation_id)" class="h-4 w-4" />
                        <ChevronDown v-else class="h-4 w-4" />
                      </Button>
                    </TableCell>
                    <TableCell class="font-medium">
                      <div>
                        <div>{{ installation.installation_name }}</div>
                        <div class="text-xs text-muted-foreground">{{ installation.server_slug }}</div>
                      </div>
                    </TableCell>
                    <TableCell class="text-right">{{ formatNumber(installation.tool_count) }}</TableCell>
                    <TableCell class="text-right">{{ formatTokens(installation.total_tokens) }}</TableCell>
                    <TableCell class="text-right">{{ formatTokens(installation.average_tokens_per_tool) }}</TableCell>
                  </TableRow>

                  <!-- Expanded Tools Rows -->
                  <template v-if="expandedRows.has(installation.installation_id)">
                    <TableRow
                      v-for="tool in installation.tools"
                      :key="`${installation.installation_id}-${tool.tool_name}`"
                      class="bg-muted/30"
                    >
                      <TableCell></TableCell>
                      <TableCell class="pl-12">
                        <div class="flex items-center gap-2">
                          <Badge variant="outline" class="font-mono text-xs">{{ tool.tool_name }}</Badge>
                        </div>
                      </TableCell>
                      <TableCell class="text-right">-</TableCell>
                      <TableCell class="text-right">{{ formatTokens(tool.token_count) }}</TableCell>
                      <TableCell class="text-right">-</TableCell>
                    </TableRow>
                  </template>
                </template>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </template>
    </div>
  </NavbarLayout>
</template>
