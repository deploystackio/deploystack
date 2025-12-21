<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DsPageHeading } from '@/components/ui/ds-page-heading'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { InstallationInfo, InstallationTabs, InstallationStatusBadge } from '@/components/mcp-server/installation'
import { useMcpInstallationCache, useStatusStream } from '@/composables/mcp-server/installation'
import { getEnv } from '@/utils/env'

const { t } = useI18n()

const {
  installation,
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
  // Only connect if installation has required fields
  if (newInstallation?.team_id && newInstallation?.id) {
    const baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')
    const url = `${baseUrl}/api/teams/${newInstallation.team_id}/mcp/installations/${newInstallation.id}/status/stream`

    // Only connect if URL changed
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
    <DsPageHeading v-if="installation" :title="installation.installation_name" :show-border="false">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink as-child>
              <RouterLink to="/mcp-server">
                {{ t('mcpInstallations.title') }}
              </RouterLink>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{{ installation.installation_name }}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <template #actions>
        <InstallationStatusBadge :status-data="statusData" size="default" />
      </template>
    </DsPageHeading>
    <DsPageHeading v-else :title="t('mcpInstallations.title')" :show-border="false">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink as-child>
              <RouterLink to="/mcp-server">
                {{ t('mcpInstallations.title') }}
              </RouterLink>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <Skeleton class="h-4 w-48" />
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </DsPageHeading>

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

      <!-- Installation Info Content -->
      <InstallationInfo v-else-if="installation" :installation="installation" :status-data="statusData" />
    </div>
  </NavbarLayout>
</template>
