<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute } from 'vue-router'
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
import { McpInstallationService } from '@/services/mcpInstallationService'
import { TeamService, type Team } from '@/services/teamService'
import { useEventBus } from '@/composables/useEventBus'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import type { McpInstallation } from '@/types/mcp-installations'

const { t } = useI18n()
const route = useRoute()
const eventBus = useEventBus()
const { setBreadcrumbs } = useBreadcrumbs()

const installation = ref<McpInstallation | null>(null)
const currentTeam = ref<Team | null>(null)
const userTeamRole = ref<'team_admin' | 'team_user' | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

const installationId = route.params.id as string

// Check if user can edit installations in this team
const canEditInstallation = computed(() => {
  return userTeamRole.value === 'team_admin'
})

// Handle installation updates
const handleInstallationUpdated = (updatedInstallation: McpInstallation) => {
  installation.value = updatedInstallation
  eventBus.emit('mcp-installations-updated')
}

// Load installation using current selected team from event bus
async function loadInstallation(installationId: string): Promise<{ team: Team; installation: McpInstallation; userRole: 'team_admin' | 'team_user' } | null> {
  try {
    const selectedTeamId = eventBus.getState<string>('selected_team_id')

    if (!selectedTeamId) {
      const userTeams = await TeamService.getUserTeams()

      for (const team of userTeams) {
        try {
          const installation = await McpInstallationService.getInstallationById(team.id, installationId)
          if (installation) {
            eventBus.setState('selected_team_id', team.id)
            return {
              team,
              installation,
              userRole: team.role || 'team_user'
            }
          }
        } catch {
          continue
        }
      }

      return null
    }

    const userTeams = await TeamService.getUserTeams()
    const selectedTeam = userTeams.find(team => team.id === selectedTeamId)

    if (!selectedTeam) {
      return null
    }

    const installation = await McpInstallationService.getInstallationById(selectedTeam.id, installationId)

    if (!installation) {
      return null
    }
    return {
      team: selectedTeam,
      installation,
      userRole: selectedTeam.role || 'team_user'
    }
  } catch {
    return null
  }
}

// Listen for team changes from event bus
const handleTeamChanged = async () => {
  await loadAndSetInstallation()
}

const loadAndSetInstallation = async () => {
  try {
    isLoading.value = true
    const result = await loadInstallation(installationId)

    if (result) {
      installation.value = result.installation
      currentTeam.value = result.team
      userTeamRole.value = result.userRole
      error.value = null

      setBreadcrumbs([
        { label: t('mcpInstallations.title'), href: '/mcp-server' },
        { label: result.installation.installation_name }
      ])
    } else {
      error.value = 'Installation not found in the selected team or no team selected'
      installation.value = null
      currentTeam.value = null
      userTeamRole.value = null
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    installation.value = null
    currentTeam.value = null
    userTeamRole.value = null
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  setBreadcrumbs([
    { label: t('mcpInstallations.title'), href: '/mcp-server' },
    { label: 'Loading...' }
  ])
  await loadAndSetInstallation()

  eventBus.on('storage-changed', (data) => {
    if (data.key === 'selected_team_id') {
      handleTeamChanged()
    }
  })
})

onUnmounted(() => {
  eventBus.off('storage-changed', handleTeamChanged)
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
