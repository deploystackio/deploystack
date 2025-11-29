<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { TeamService, type TeamUsageData } from '@/services/teamService'

const { t } = useI18n()

interface Props {
  teamId: string
}

const props = defineProps<Props>()

// State
const usageData = ref<TeamUsageData | null>(null)
const isLoading = ref(true)

// Load usage data
const loadUsageData = async () => {
  try {
    isLoading.value = true
    usageData.value = await TeamService.getTeamUsage(props.teamId)
  } catch (err) {
    // Fail silently - hide the indicator on error
    usageData.value = null
    console.error('Error loading team usage indicator:', err)
  } finally {
    isLoading.value = false
  }
}

// Watch for team changes and reload data
watch(() => props.teamId, () => {
  loadUsageData()
}, { immediate: false })

onMounted(() => {
  loadUsageData()
})
</script>

<template>
  <div
    v-if="usageData && !isLoading"
    class="flex items-center gap-2 text-sm text-muted-foreground"
  >
    <span>
      {{ t('teams.usageIndicator.totalMcpServers') }}
      <span class="font-medium text-foreground">
        {{ usageData.total_installed_mcp_servers }}/{{ usageData.limits.mcp_server_limit }}
      </span>
    </span>
    <span class="text-gray-300">|</span>
    <span>
      {{ t('teams.usageIndicator.stdioMcpServers') }}
      <span class="font-medium text-foreground">
        {{ usageData.non_http_mcp_servers }}/{{ usageData.limits.non_http_mcp_limit }}
      </span>
    </span>
  </div>
</template>
