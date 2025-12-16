<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
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
import { TeamConfiguration, InstallationTabs } from '@/components/mcp-server/installation'
import { useMcpInstallationCache } from '@/composables/mcp-server/installation'
import { useEventBus } from '@/composables/useEventBus'
import type { McpInstallation } from '@/types/mcp-installations'

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

onMounted(async () => {
  initializeCache()
  await loadAndSetInstallation()
  setupWatchers()
})

onUnmounted(() => {
  cleanupWatchers()
})
</script>

<template>
  <NavbarLayout>
    <DsPageHeading v-if="installation" :title="installation.installation_name">
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
    </DsPageHeading>
    <DsPageHeading v-else :title="t('mcpInstallations.title')">
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
      <!-- Error State -->
      <div v-if="error" class="text-red-500">
        {{ t('mcpInstallations.view.errorLoading', { error }) }}
      </div>

      <!-- Loading State -->
      <div v-else-if="isLoading" class="space-y-6">
        <Skeleton class="h-12 w-full" />
        <div class="space-y-4">
          <Skeleton class="h-32 w-full rounded-lg" />
          <Skeleton class="h-32 w-full rounded-lg" />
          <Skeleton class="h-32 w-full rounded-lg" />
        </div>
      </div>

      <!-- Installation Details with Tabs -->
      <div v-else-if="installation && currentTeam">
        <InstallationTabs
          :installation="installation"
          :installation-id="installationId"
        />

        <TeamConfiguration
          :installation="installation"
          :team-id="currentTeam.id"
          :can-edit="canEditInstallation"
          :user-role="userTeamRole"
          @installation-updated="handleInstallationUpdated"
        />
      </div>
    </div>
  </NavbarLayout>
</template>
