<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertTriangle } from 'lucide-vue-next'
import { DsTabs, DsTabsItem } from '@/components/ui/ds-tabs'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { TeamInfo, TeamMembers, TeamUsage, TeamDangerZone } from '@/components/teams/manage'
import { TeamService, type Team } from '@/services/teamService'
import { useEventBus } from '@/composables/useEventBus'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const eventBus = useEventBus()
const { setBreadcrumbs } = useBreadcrumbs()

// State
const team = ref<Team | null>(null)
const isLoading = ref(true)
const isRetrying = ref(false)
const error = ref<string | null>(null)
const activeTab = ref('team-info')

// Computed properties
const teamId = computed(() => route.params.id as string)

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

    // Update breadcrumbs with team name
    setBreadcrumbs([
      { label: t('teams.title'), href: '/teams' },
      { label: teamData.name }
    ])

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

// Initialize tab from query parameter
const initializeTab = () => {
  const tabFromQuery = route.query.tab as string
  if (tabFromQuery && ['team-info', 'members', 'usage', 'danger-zone'].includes(tabFromQuery)) {
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
  setBreadcrumbs([
    { label: t('teams.title'), href: '/teams' },
    { label: t('teams.manage.loading') }
  ])
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
  <DashboardLayout>
    <div class="space-y-6">
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
            :disabled="isRetrying"
            @click="loadTeam"
          >
            <Spinner v-if="isRetrying" class="mr-2" />
            {{ t('teams.manage.errorActions.tryAgain') }}
          </Button>
          <Button variant="ghost" size="sm" @click="router.push('/teams')">
            {{ t('teams.manage.errorActions.backToTeams') }}
          </Button>
        </div>
      </Alert>

      <!-- Team Management with Tabs -->
      <div v-else-if="team">
        <DsTabs v-model="activeTab" variant="underlined" class="mb-10">
          <DsTabsItem value="team-info" label="Team Info" />
          <DsTabsItem
            value="members"
            label="Members"
            :badge="memberCount > 1 ? memberCount : undefined"
          />
          <DsTabsItem value="usage" label="Usage" />
          <DsTabsItem value="danger-zone" label="Danger Zone" />
        </DsTabs>

        <!-- Tab Content -->
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
        <TeamUsage
          v-if="activeTab === 'usage'"
          :team="team"
        />
        <TeamDangerZone
          v-if="activeTab === 'danger-zone'"
          :team="team"
          :can-delete-team="canDeleteTeam"
        />
      </div>
    </div>
  </DashboardLayout>
</template>
