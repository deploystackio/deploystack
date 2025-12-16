<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertTriangle,
  Server,
  RefreshCw,
  HardDrive,
  Globe
} from 'lucide-vue-next'
import { Skeleton } from '@/components/ui/skeleton'
import { TeamService, type Team, type TeamUsageData } from '@/services/teamService'
import { DsCard } from '@/components/ui/ds-card'
import { DsMeter, DsMeterTrack, DsMeterIndicator, DsMeterLabel, DsMeterValue } from '@/components/ui/ds-meter'

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
  <div>
    <!-- Loading State -->
    <DsCard v-if="isLoading" :title="t('teams.manage.usage.title')">
      <Skeleton class="h-4 w-64 mb-6" />
      <dl class="divide-y divide-gray-100">
        <div v-for="i in 3" :key="i" class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          <dt class="flex items-center gap-2">
            <Skeleton class="h-4 w-4 rounded" />
            <Skeleton class="h-4 w-32" />
          </dt>
          <dd class="mt-1 sm:col-span-2 sm:mt-0">
            <div class="space-y-2 max-w-md">
              <div class="flex justify-between">
                <Skeleton class="h-4 w-16" />
                <Skeleton class="h-4 w-10" />
              </div>
              <Skeleton class="h-2 w-full rounded-full" />
              <Skeleton class="h-3 w-48" />
            </div>
          </dd>
        </div>
      </dl>
    </DsCard>

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
    <DsCard v-else-if="usageData" :title="t('teams.manage.usage.title')">
      <p class="text-sm mb-6">{{ t('teams.manage.usage.description') }}</p>
      <dl class="divide-y divide-gray-100">
          <!-- Total MCP Servers -->
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm/6 font-medium text-gray-900 flex items-center gap-2">
              <Server class="h-4 w-4 text-muted-foreground" />
              {{ t('teams.manage.usage.totalMcpServers') }}
            </dt>
            <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
              <DsMeter :value="totalMcpPercentage" class="space-y-2 max-w-md">
                <div class="flex justify-between text-sm">
                  <DsMeterLabel class="font-normal">
                    {{ usageData.total_installed_mcp_servers }} / {{ usageData.limits.mcp_server_limit }}
                  </DsMeterLabel>
                  <DsMeterValue :class="isAtTotalLimit ? 'text-destructive font-medium' : 'text-muted-foreground'" />
                </div>
                <DsMeterTrack>
                  <DsMeterIndicator :class="isAtTotalLimit ? 'bg-destructive' : ''" />
                </DsMeterTrack>
                <p v-if="isAtTotalLimit" class="text-xs text-destructive">
                  {{ t('teams.manage.usage.limitReached') }}
                </p>
              </DsMeter>
            </dd>
          </div>

          <!-- Non-HTTP MCP Servers -->
          <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm/6 font-medium text-gray-900 flex items-center gap-2">
              <HardDrive class="h-4 w-4 text-muted-foreground" />
              {{ t('teams.manage.usage.nonHttpMcpServers') }}
            </dt>
            <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
              <DsMeter :value="nonHttpMcpPercentage" class="space-y-2 max-w-md">
                <div class="flex justify-between text-sm">
                  <DsMeterLabel class="font-normal">
                    {{ usageData.non_http_mcp_servers }} / {{ usageData.limits.non_http_mcp_limit }}
                  </DsMeterLabel>
                  <DsMeterValue :class="isAtNonHttpLimit ? 'text-destructive font-medium' : 'text-muted-foreground'" />
                </div>
                <DsMeterTrack>
                  <DsMeterIndicator :class="isAtNonHttpLimit ? 'bg-destructive' : ''" />
                </DsMeterTrack>
                <p v-if="isAtNonHttpLimit" class="text-xs text-destructive">
                  {{ t('teams.manage.usage.limitReached') }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ t('teams.manage.usage.nonHttpDescription') }}
                </p>
              </DsMeter>
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

      <template #footer-actions>
        <Button
          variant="outline"
          @click="loadUsageData"
          :disabled="isLoading"
          class="gap-2"
        >
          <RefreshCw class="h-4 w-4" :class="isLoading ? 'animate-spin' : ''" />
          {{ t('teams.manage.usage.refresh') }}
        </Button>
      </template>
    </DsCard>
  </div>
</template>
