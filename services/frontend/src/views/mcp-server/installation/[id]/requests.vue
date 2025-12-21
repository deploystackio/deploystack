<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Skeleton } from '@/components/ui/skeleton'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { RequestsTab, InstallationTabs, InstallationPageHeading } from '@/components/mcp-server/installation'
import { useMcpInstallationCache, useStatusStream } from '@/composables/mcp-server/installation'
import { getEnv } from '@/utils/env'

const { t } = useI18n()

const {
  installation,
  currentTeam,
  isLoading,
  error,
  installationId,
  loadAndSetInstallation,
  initializeCache,
  setupWatchers,
  cleanupWatchers
} = useMcpInstallationCache()

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
      <!-- Tabs - Always visible when installation is loaded -->
      <InstallationTabs
        v-if="installation"
        :installation="installation"
        :installation-id="installationId"
      />

      <!-- Error State -->
      <div v-if="error" class="text-red-500">
        {{ t('mcpInstallations.view.errorLoading', { error }) }}
      </div>

      <!-- Loading State for Content -->
      <div v-else-if="isLoading" class="space-y-4">
        <Skeleton class="h-32 w-full rounded-lg" />
        <Skeleton class="h-32 w-full rounded-lg" />
        <Skeleton class="h-32 w-full rounded-lg" />
      </div>

      <!-- Requests Content -->
      <RequestsTab
        v-else-if="installation && currentTeam"
        :installation="installation"
        :team-id="currentTeam.id"
      />
    </div>
  </NavbarLayout>
</template>
