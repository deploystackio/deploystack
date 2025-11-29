<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Loader2,
  AlertTriangle,
  Server,
  RefreshCw,
  HardDrive,
  Globe
} from 'lucide-vue-next'
import { TeamService, type Team, type TeamUsageData } from '@/services/teamService'

const { t } = useI18n()

interface Props {
  team: Team
}

const props = defineProps<Props>()

// State
const usageData = ref<TeamUsageData | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

// Computed properties
const totalMcpPercentage = computed(() => {
  if (!usageData.value) return 0
  const { total_installed_mcp_servers, limits } = usageData.value
  if (limits.mcp_server_limit === 0) return 0
  return Math.min(100, (total_installed_mcp_servers / limits.mcp_server_limit) * 100)
})

const nonHttpMcpPercentage = computed(() => {
  if (!usageData.value) return 0
  const { non_http_mcp_servers, limits } = usageData.value
  if (limits.non_http_mcp_limit === 0) return 0
  return Math.min(100, (non_http_mcp_servers / limits.non_http_mcp_limit) * 100)
})

const isAtTotalLimit = computed(() => {
  if (!usageData.value) return false
  return usageData.value.total_installed_mcp_servers >= usageData.value.limits.mcp_server_limit
})

const isAtNonHttpLimit = computed(() => {
  if (!usageData.value) return false
  return usageData.value.non_http_mcp_servers >= usageData.value.limits.non_http_mcp_limit
})

// Load usage data
const loadUsageData = async () => {
  try {
    isLoading.value = true
    error.value = null
    usageData.value = await TeamService.getTeamUsage(props.team.id)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load usage data'
    console.error('Error loading team usage:', err)
  } finally {
    isLoading.value = false
  }
}

// Watch for team changes and reload data
watch(() => props.team.id, () => {
  loadUsageData()
}, { immediate: false })

onMounted(() => {
  loadUsageData()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <div class="flex items-center gap-3 text-muted-foreground">
        <Loader2 class="h-5 w-5 animate-spin" />
        {{ t('teams.manage.usage.loading') }}
      </div>
    </div>

    <!-- Error State -->
    <Alert v-else-if="error" variant="destructive">
      <AlertTriangle class="h-4 w-4" />
      <AlertDescription>
        {{ error }}
      </AlertDescription>
      <div class="mt-4">
        <Button
          variant="outline"
          size="sm"
          @click="loadUsageData"
        >
          <RefreshCw class="h-4 w-4 mr-2" />
          {{ t('teams.manage.usage.retry') }}
        </Button>
      </div>
    </Alert>

    <!-- Usage Content -->
    <div v-else-if="usageData">
      <div class="px-4 sm:px-0">
        <h3 class="text-base/7 font-semibold text-gray-900">{{ t('teams.manage.usage.title') }}</h3>
        <p class="mt-1 max-w-2xl text-sm/6 text-gray-500">{{ t('teams.manage.usage.description') }}</p>
      </div>

      <div class="mt-6 border-t border-gray-100">
        <dl class="divide-y divide-gray-100">
          <!-- Total MCP Servers -->
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm/6 font-medium text-gray-900 flex items-center gap-2">
              <Server class="h-4 w-4 text-muted-foreground" />
              {{ t('teams.manage.usage.totalMcpServers') }}
            </dt>
            <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
              <div class="space-y-2 max-w-md">
                <div class="flex justify-between text-sm">
                  <span>{{ usageData.total_installed_mcp_servers }} / {{ usageData.limits.mcp_server_limit }}</span>
                  <span :class="isAtTotalLimit ? 'text-destructive font-medium' : 'text-muted-foreground'">
                    {{ Math.round(totalMcpPercentage) }}%
                  </span>
                </div>
                <Progress
                  :model-value="totalMcpPercentage"
                  :class="isAtTotalLimit ? '[&>div]:bg-destructive' : ''"
                />
                <p v-if="isAtTotalLimit" class="text-xs text-destructive">
                  {{ t('teams.manage.usage.limitReached') }}
                </p>
              </div>
            </dd>
          </div>

          <!-- Non-HTTP MCP Servers -->
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm/6 font-medium text-gray-900 flex items-center gap-2">
              <HardDrive class="h-4 w-4 text-muted-foreground" />
              {{ t('teams.manage.usage.nonHttpMcpServers') }}
            </dt>
            <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
              <div class="space-y-2 max-w-md">
                <div class="flex justify-between text-sm">
                  <span>{{ usageData.non_http_mcp_servers }} / {{ usageData.limits.non_http_mcp_limit }}</span>
                  <span :class="isAtNonHttpLimit ? 'text-destructive font-medium' : 'text-muted-foreground'">
                    {{ Math.round(nonHttpMcpPercentage) }}%
                  </span>
                </div>
                <Progress
                  :model-value="nonHttpMcpPercentage"
                  :class="isAtNonHttpLimit ? '[&>div]:bg-destructive' : ''"
                />
                <p v-if="isAtNonHttpLimit" class="text-xs text-destructive">
                  {{ t('teams.manage.usage.limitReached') }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ t('teams.manage.usage.nonHttpDescription') }}
                </p>
              </div>
            </dd>
          </div>

          <!-- HTTP MCP Servers (info only) -->
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm/6 font-medium text-gray-900 flex items-center gap-2">
              <Globe class="h-4 w-4 text-muted-foreground" />
              {{ t('teams.manage.usage.httpMcpServers') }}
            </dt>
            <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
              <div class="space-y-1">
                <span class="font-medium">{{ usageData.http_mcp_servers }}</span>
                <p class="text-xs text-muted-foreground">
                  {{ t('teams.manage.usage.httpDescription') }}
                </p>
              </div>
            </dd>
          </div>
        </dl>
      </div>

      <!-- Refresh Button -->
      <div class="flex items-center justify-end pt-4 border-t">
        <Button
          variant="outline"
          @click="loadUsageData"
          :disabled="isLoading"
          class="gap-2"
        >
          <RefreshCw class="h-4 w-4" :class="isLoading ? 'animate-spin' : ''" />
          {{ t('teams.manage.usage.refresh') }}
        </Button>
      </div>
    </div>
  </div>
</template>
