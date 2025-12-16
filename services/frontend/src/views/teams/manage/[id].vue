<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle } from 'lucide-vue-next'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { SettingsMenu, SettingsMenuGroup, SettingsMenuItem } from '@/components/ui/settings-menu'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { DsPageHeading } from '@/components/ui/ds-page-heading'
import { TeamInfo, TeamMembers, TeamUsage } from '@/components/teams/manage'
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
  // Merge updated team data while preserving permission fields
  // that may not be returned by the update endpoint
  if (team.value) {
    team.value = {
      ...team.value,
      ...updatedTeam,
      // Explicitly preserve permission fields if they're not in the update response
      role: updatedTeam.role ?? team.value.role,
      is_admin: updatedTeam.is_admin ?? team.value.is_admin,
      is_owner: updatedTeam.is_owner ?? team.value.is_owner,
      member_count: updatedTeam.member_count ?? team.value.member_count,
    }
  } else {
    team.value = updatedTeam
  }
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
  if (tabFromQuery && ['team-info', 'members', 'usage'].includes(tabFromQuery)) {
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

// Watch for query parameter changes to update active tab
watch(
  () => route.query.tab,
  (newTab) => {
    if (newTab && ['team-info', 'members', 'usage'].includes(newTab as string)) {
      activeTab.value = newTab as string
    } else if (!newTab) {
      activeTab.value = 'team-info'
    }
  }
)

// Helper to build tab URL
const getTabUrl = (tab: string) => {
  const base = `/teams/manage/${teamId.value}`
  return tab === 'team-info' ? base : `${base}?tab=${tab}`
}

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
  <NavbarLayout>
    <DsPageHeading :title="t('teams.title')">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink as-child>
              <RouterLink to="/teams">
                {{ t('teams.title') }}
              </RouterLink>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage v-if="team">{{ team.name }}</BreadcrumbPage>
            <Skeleton v-else class="h-4 w-32" />
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </DsPageHeading>

    <div class="space-y-6 mt-6">
      <!-- Loading State -->
      <div v-if="isLoading" class="flex flex-col md:flex-row md:space-x-12">
        <!-- Sidebar Skeleton -->
        <aside class="md:w-1/5 mb-6 md:mb-0">
          <div class="space-y-1">
            <Skeleton class="h-10 w-full rounded-md" />
            <Skeleton class="h-10 w-full rounded-md" />
            <Skeleton class="h-10 w-full rounded-md" />
          </div>
        </aside>

        <!-- Content Area Skeleton -->
        <div class="flex-1 space-y-6">
          <Skeleton class="h-8 w-48" />
          <div class="space-y-4">
            <Skeleton class="h-24 w-full rounded-lg" />
            <Skeleton class="h-24 w-full rounded-lg" />
            <Skeleton class="h-24 w-full rounded-lg" />
          </div>
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

      <!-- Team Management with Sidebar Navigation -->
      <div v-else-if="team" class="flex flex-col md:flex-row md:space-x-12">
        <!-- Sidebar Navigation -->
        <aside class="md:w-1/5 mb-6 md:mb-0">
          <SettingsMenu>
            <SettingsMenuGroup>
              <SettingsMenuItem
                :to="getTabUrl('team-info')"
                :active="activeTab === 'team-info'"
              >
                General
              </SettingsMenuItem>
              <SettingsMenuItem
                :to="getTabUrl('members')"
                :active="activeTab === 'members'"
              >
                Members
              </SettingsMenuItem>
              <SettingsMenuItem
                :to="getTabUrl('usage')"
                :active="activeTab === 'usage'"
              >
                Usage
              </SettingsMenuItem>
            </SettingsMenuGroup>
          </SettingsMenu>
        </aside>

        <!-- Content Area -->
        <div class="flex-1">
          <TeamInfo
            v-if="activeTab === 'team-info'"
            :team="team"
            :can-edit-name="canEditName"
            :can-edit-description="canEditDescription"
            :can-delete-team="canDeleteTeam"
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
        </div>
      </div>
    </div>
  </NavbarLayout>
</template>
