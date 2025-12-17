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
import { McpToolsTab, InstallationTabs } from '@/components/mcp-server/installation'
import { useMcpInstallationCache } from '@/composables/mcp-server/installation'

const { t } = useI18n()

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

      <!-- MCP Tools Content -->
      <McpToolsTab
        v-else-if="installation && currentTeam"
        :installation="installation"
        :team-id="currentTeam.id"
        :can-edit="canEditInstallation"
        :user-role="userTeamRole"
      />
    </div>
  </NavbarLayout>
</template>
