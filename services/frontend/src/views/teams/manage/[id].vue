<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Info, Users, Shield, Loader2, AlertTriangle } from 'lucide-vue-next'
import { DsTabs, DsTabsItem } from '@/components/ui/ds-tabs'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { TeamInfo, TeamMembers, TeamDangerZone } from '@/components/teams/manage'
import { TeamService, type Team } from '@/services/teamService'
import { useEventBus } from '@/composables/useEventBus'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const eventBus = useEventBus()

// State
const team = ref<Team | null>(null)
const isLoading = ref(true)
const isRetrying = ref(false)
const error = ref<string | null>(null)
const activeTab = ref('team-info')

// Computed properties
const teamId = computed(() => route.params.id as string)

const pageTitle = computed(() => {
  return team.value
    ? `${t('teams.manage.title')}: ${team.value.name}`
    : t('teams.manage.loading')
})

const canEditName = computed(() => {
  return team.value?.is_admin === true &&
         !team.value?.is_default
})

const canEditDescription = computed(() => {
  return team.value?.is_admin === true
})

const canManageMembers = computed(() => {
  return team.value?.is_admin === true
})

const canDeleteTeam = computed(() => {
  return team.value?.is_owner === true &&
         !team.value?.is_default
})

// Mock member count for badge (in real implementation, this would come from team data)
const memberCount = computed(() => {
  if (!team.value) return 0
  // For now, return 1 (just the owner) - in real implementation, get from team.members.length
  return 1
})

// Load team data
const loadTeam = async () => {
  try {
    isLoading.value = true
    isRetrying.value = true
    error.value = null

    const teamData = await TeamService.getTeamById(teamId.value)
    team.value = teamData

  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load team'
    console.error('Error loading team:', err)
  } finally {
    isLoading.value = false
    isRetrying.value = false
  }
}

// Handle team updates
const handleTeamUpdated = (updatedTeam: Team) => {
  team.value = updatedTeam
}

// Handle team selection from sidebar
const handleTeamSelected = (data: { teamId: string; teamName: string }) => {
  // If we're switching to a different team, navigate to that team's manage page
  if (data.teamId !== teamId.value) {
    // Preserve the current tab when switching teams
    const currentTab = activeTab.value
    router.push({
      path: `/teams/manage/${data.teamId}`,
      query: currentTab !== 'team-info' ? { tab: currentTab } : undefined
    })
  }
}

// Navigate back to teams list
const goBack = () => {
  router.push('/teams')
}

// Initialize tab from query parameter
const initializeTab = () => {
  const tabFromQuery = route.query.tab as string
  if (tabFromQuery && ['team-info', 'members', 'danger-zone'].includes(tabFromQuery)) {
    activeTab.value = tabFromQuery
  }
}

// Watch for route parameter changes to reload team data
watch(
  () => route.params.id,
  (newTeamId, oldTeamId) => {
    if (newTeamId && newTeamId !== oldTeamId) {
      loadTeam()
    }
  },
  { immediate: false } // Don't run immediately since onMounted handles the initial load
)

// Load data on mount
onMounted(() => {
  initializeTab()
  loadTeam()

  // Listen for team selection events from sidebar
  eventBus.on('team-selected', handleTeamSelected)
})

onUnmounted(() => {
  // Clean up event listeners to prevent memory leaks
  eventBus.off('team-selected', handleTeamSelected)
})
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
          {{ t('teams.manage.backToTeams') }}
        </Button>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <div class="flex items-center gap-3 text-muted-foreground">
          <Loader2 class="h-5 w-5 animate-spin" />
          {{ t('teams.manage.loading') }}
        </div>
      </div>

      <!-- Error State -->
      <Alert v-else-if="error" variant="destructive">
        <AlertTriangle class="h-4 w-4" />
        <AlertDescription>
          {{ error }}
        </AlertDescription>
        <div class="mt-4 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            :loading="isRetrying"
            :loading-text="t('teams.manage.errorActions.loading')"
            @click="loadTeam"
          >
            {{ t('teams.manage.errorActions.tryAgain') }}
          </Button>
          <Button variant="ghost" size="sm" @click="goBack">
            {{ t('teams.manage.errorActions.backToTeams') }}
          </Button>
        </div>
      </Alert>

      <!-- Team Management with Tabs -->
      <div v-else-if="team" class="space-y-6">
        <DsTabs v-model="activeTab">
          <DsTabsItem value="team-info" label="Team Info">
            <Info class="h-4 w-4" />
          </DsTabsItem>
          <DsTabsItem
            value="members"
            label="Members"
            :badge="memberCount > 1 ? memberCount : undefined"
          >
            <Users class="h-4 w-4" />
          </DsTabsItem>
          <DsTabsItem value="danger-zone" label="Danger Zone">
            <Shield class="h-4 w-4" />
          </DsTabsItem>
        </DsTabs>

        <!-- Tab Content -->
        <div>
          <!-- Content Wrapper with same styling as MCP installation page -->
          <div class="bg-muted/50 rounded-lg sm:rounded-lg">
            <div class="py-16">
              <div class="mx-auto max-w-7xl sm:px-2 lg:px-8">
                <div class="mx-auto max-w-2xl px-4 lg:max-w-4xl lg:px-0">
                  <!-- White Card inside the gray wrapper -->
                  <Card class="bg-white shadow-sm">
                    <CardContent class="p-6">
                      <TeamInfo
                        v-if="activeTab === 'team-info'"
                        :team="team"
                        :can-edit-name="canEditName"
                        :can-edit-description="canEditDescription"
                        @team-updated="handleTeamUpdated"
                      />
                      <TeamMembers
                        v-if="activeTab === 'members'"
                        :team="team"
                        :can-manage-members="canManageMembers"
                      />
                      <TeamDangerZone
                        v-if="activeTab === 'danger-zone'"
                        :team="team"
                        :can-delete-team="canDeleteTeam"
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>
