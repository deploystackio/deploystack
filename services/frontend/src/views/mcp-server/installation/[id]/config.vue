<script setup lang="ts">
import { onMounted, onUnmounted, computed, watch } from 'vue'
import { Skeleton } from '@/components/ui/skeleton'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { ConfigurationView, InstallationTabs, InstallationPageHeading } from '@/components/mcp-server/installation'
import { useMcpInstallationCache, useStatusStream } from '@/composables/mcp-server/installation'
import { useEventBus } from '@/composables/useEventBus'
import type { McpInstallation } from '@/types/mcp-installations'
import { getEnv } from '@/utils/env'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const eventBus = useEventBus()

const {
  installation,
  currentTeam,
  userTeamRole,
  isLoading,
  error,
  installationId,
  loadAndSetInstallation,
  initializeCache,
  setupWatchers,
  cleanupWatchers
} = useMcpInstallationCache()

const canEditInstallation = computed(() => {
  return userTeamRole.value === 'team_admin'
})

const handleInstallationUpdated = (updatedInstallation: McpInstallation) => {
  installation.value = updatedInstallation
  eventBus.emit('mcp-installations-updated')
}

const { statusData, connect, disconnect } = useStatusStream()

let currentStreamUrl: string | null = null

onMounted(async () => {
  initializeCache()
  await loadAndSetInstallation()
  setupWatchers()
})

watch(installation, (newInstallation) => {
  if (newInstallation?.team_id && newInstallation?.id) {
    const baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')
    const url = `${baseUrl}/api/teams/${newInstallation.team_id}/mcp/installations/${newInstallation.id}/status/stream`

    if (url !== currentStreamUrl) {
      currentStreamUrl = url
      connect(url)
    }
  }
})

onUnmounted(() => {
  cleanupWatchers()
  disconnect()
})
</script>

<template>
  <NavbarLayout>
    <InstallationPageHeading :installation="installation" :status-data="statusData" />

    <div class="space-y-6 mt-6">
      <InstallationTabs
        v-if="installation"
        :installation="installation"
        :installation-id="installationId"
      />

      <div v-if="error" class="text-red-500">
        {{ t('mcpInstallations.view.errorLoading', { error }) }}
      </div>

      <div v-else-if="isLoading" class="space-y-4">
        <Skeleton class="h-32 w-full rounded-lg" />
        <Skeleton class="h-32 w-full rounded-lg" />
        <Skeleton class="h-32 w-full rounded-lg" />
      </div>

      <ConfigurationView
        v-else-if="installation && currentTeam"
        :installation="installation"
        :team-id="currentTeam.id"
        :can-edit="canEditInstallation"
        :user-role="userTeamRole"
        @installation-updated="handleInstallationUpdated"
      />
    </div>
  </NavbarLayout>
</template>
