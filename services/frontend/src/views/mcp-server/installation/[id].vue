<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Info, Settings, Shield } from 'lucide-vue-next'
import { DsTabs, DsTabsItem } from '@/components/ui/ds-tabs'
import DashboardLayout from '@/components/DashboardLayout.vue'
import ContentWrapper from '@/components/ContentWrapper.vue'
import { InstallationInfo, TeamConfiguration, DangerZone } from '@/components/mcp-server/installation'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { TeamService, type Team } from '@/services/teamService'
import { useEventBus } from '@/composables/useEventBus'
import type { McpInstallation } from '@/types/mcp-installations'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const eventBus = useEventBus()

const installation = ref<McpInstallation | null>(null)
const currentTeam = ref<Team | null>(null)
const userTeamRole = ref<'team_admin' | 'team_user' | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const activeTab = ref('information')

const installationId = route.params.id as string



// Load installation using current selected team from event bus
async function loadInstallation(installationId: string): Promise<{ team: Team; installation: McpInstallation; userRole: 'team_admin' | 'team_user' } | null> {
  try {
    // Get selected team from event bus storage
    const selectedTeamId = eventBus.getState<string>('selected_team_id')
    
    if (!selectedTeamId) {
      // Fallback: try to find which team owns this installation
      const userTeams = await TeamService.getUserTeams()
      
      for (const team of userTeams) {
        try {
          const installation = await McpInstallationService.getInstallationById(team.id, installationId)
          if (installation) {
            // Set this team as selected in storage
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

    // Get user's teams to find the selected team with role information
    const userTeams = await TeamService.getUserTeams()
    const selectedTeam = userTeams.find(team => team.id === selectedTeamId)

    if (!selectedTeam) {
      return null
    }

    // Load installation from the selected team
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

// Load installation on component mount
onMounted(async () => {
  await loadAndSetInstallation()
  
  // Listen for team selection changes
  eventBus.on('storage-changed', (data) => {
    if (data.key === 'selected_team_id') {
      handleTeamChanged()
    }
  })
})

onUnmounted(() => {
  // Clean up event listeners
  eventBus.off('storage-changed', handleTeamChanged)
})



// Computed properties for display
const pageTitle = computed(() => {
  return installation.value
    ? `Installation: ${installation.value.installation_name}`
    : 'Loading Installation...'
})

// Check if environment variables exist for badge display
const environmentVariablesCount = computed(() => {
  if (!installation.value?.user_environment_variables) return 0
  return Object.keys(installation.value.user_environment_variables).length
})

// Check if user can edit installations in this team
const canEditInstallation = computed(() => {
  // Only team_admin can edit installations (team_user cannot)
  // If role is null/undefined, default to false (no edit permissions)
  return userTeamRole.value === 'team_admin'
})

const goBack = () => {
  router.push('/mcp-server')
}

// Handle installation updates
const handleInstallationUpdated = (updatedInstallation: McpInstallation) => {
  // Update the local installation data
  installation.value = updatedInstallation

  // Emit event for other components that might need to refresh
  eventBus.emit('mcp-installations-updated')
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
</script>

<template>
  <DashboardLayout :title="pageTitle">
    <div class="space-y-6">
      <!-- Header with Back Button -->
      <div class="flex items-center justify-between">
        <Button
          variant="outline"
          @click="goBack"
        >
          <ArrowLeft class="h-4 w-4 mr-2" />
          {{ t('mcpInstallations.view.backToServers') }}
        </Button>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-muted-foreground">
        {{ t('mcpInstallations.view.loading') }}
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-red-500">
        {{ t('mcpInstallations.view.errorLoading', { error }) }}
      </div>

      <!-- Installation Details with Tabs -->
      <div v-else-if="installation && currentTeam">

        <DsTabs v-model="activeTab">
          <DsTabsItem value="information" label="Installation Info">
            <Info class="h-4 w-4" />
          </DsTabsItem>
          <DsTabsItem
            value="environment"
            label="Team Configuration"
            :badge="environmentVariablesCount > 0 ? environmentVariablesCount : undefined"
          >
            <Settings class="h-4 w-4" />
          </DsTabsItem>
          <DsTabsItem value="danger-zone" label="Danger Zone">
            <Shield class="h-4 w-4" />
          </DsTabsItem>
        </DsTabs>

        <!-- Tab Content -->
        <ContentWrapper>
          <InstallationInfo
            v-if="activeTab === 'information'"
            :installation="installation"
          />
          <TeamConfiguration
            v-if="activeTab === 'environment'"
            :installation="installation"
            :team-id="currentTeam.id"
            :can-edit="canEditInstallation"
            :user-role="userTeamRole"
            @installation-updated="handleInstallationUpdated"
          />
          <DangerZone
            v-if="activeTab === 'danger-zone'"
            :installation="installation"
            :team-id="currentTeam.id"
            :can-edit="canEditInstallation"
            :user-role="userTeamRole"
          />
        </ContentWrapper>
      </div>
    </div>
  </DashboardLayout>
</template>
