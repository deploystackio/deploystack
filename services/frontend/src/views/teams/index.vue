<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-vue-next'
import DashboardLayout from '@/components/DashboardLayout.vue'
import AddTeamModal from '@/components/teams/AddTeamModal.vue'
import { TeamService, type TeamWithRole, type Team } from '@/services/teamService'
import { UserService } from '@/services/userService'
import { useEventBus } from '@/composables/useEventBus'
import TeamTableColumns from './TeamTableColumns.vue'
import { useRouter, useRoute } from 'vue-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, AlertCircle } from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const eventBus = useEventBus()

// State
const teams = ref<TeamWithRole[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const showAddModal = ref(false)
const userPermissions = ref<string[]>([])
const deleteSuccessMessage = ref<string | null>(null)
const createSuccessMessage = ref<string | null>(null)
const createErrorMessage = ref<string | null>(null)
const searchQuery = ref('')

// Team switching state
const selectedTeam = ref<Team | null>(null)

// Handle manage team navigation
const handleManageTeam = (teamId: string) => {
  router.push(`/teams/manage/${teamId}`)
}

// Handle team switching
const handleSwitchTeam = (teamId: string) => {
  const team = teams.value.find(t => t.id === teamId)
  if (team) {
    selectedTeam.value = team
    // Store team selection in persistent storage
    eventBus.setState('selected_team_id', team.id)
    // Emit global event for team selection to update sidebar
    eventBus.emit('team-selected', { teamId: team.id, teamName: team.name })
  }
}

// Handle team selection from sidebar
const handleTeamSelectedFromSidebar = (data: { teamId: string; teamName: string }) => {
  // Find the team in our local teams list and update selectedTeam
  const team = teams.value.find(t => t.id === data.teamId)
  if (team) {
    selectedTeam.value = team
  } else {
    // If team not found in current list, create a basic team object
    selectedTeam.value = { id: data.teamId, name: data.teamName } as Team
  }
}

// Check user permissions
const checkPermissions = async () => {
  try {
    const user = await UserService.getCurrentUser()
    if (user?.role?.permissions) {
      userPermissions.value = user.role.permissions
    }
  } catch (error) {
    console.error('Error checking permissions:', error)
    userPermissions.value = []
  }
}

// Filter teams based on search query
const filteredTeams = computed(() => {
  if (!searchQuery.value) {
    return teams.value
  }
  const query = searchQuery.value.toLowerCase()
  return teams.value.filter(team =>
    team.name.toLowerCase().includes(query) ||
    (team.description && team.description.toLowerCase().includes(query))
  )
})

// Initialize selected team from storage
const initializeSelectedTeam = async () => {
  try {
    const userTeams = await TeamService.getUserTeams()
    if (userTeams.length > 0) {
      const storedTeamId = eventBus.getState<string>('selected_team_id')

      if (storedTeamId) {
        // Try to find the stored team in available teams
        const storedTeam = userTeams.find(team => team.id === storedTeamId)
        if (storedTeam) {
          selectedTeam.value = storedTeam
        } else {
          // Stored team not found, fallback to default team
          const defaultTeam = userTeams.find(team => team.is_default) || userTeams[0]
          selectedTeam.value = defaultTeam
          eventBus.setState('selected_team_id', defaultTeam.id)
        }
      } else {
        // No stored team, use default team
        const defaultTeam = userTeams.find(team => team.is_default) || userTeams[0]
        selectedTeam.value = defaultTeam
        eventBus.setState('selected_team_id', defaultTeam.id)
      }
    }
  } catch (error) {
    console.error('Error initializing selected team:', error)
  }
}

// Fetch teams from API
const fetchTeams = async (forceRefresh = false): Promise<void> => {
  try {
    isLoading.value = true
    error.value = null

    // Clear cache if force refresh is requested
    if (forceRefresh) {
      TeamService.clearUserTeamsCache()
    }

    teams.value = await TeamService.getUserTeamsWithRoles()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    teams.value = []
  } finally {
    isLoading.value = false
  }
}

// Handle team creation success
const handleTeamCreated = async (teamData?: { name: string }) => {
  // Clear any previous messages
  createSuccessMessage.value = null
  createErrorMessage.value = null

  try {
    await fetchTeams()
    // Emit global event to update sidebar and other components
    eventBus.emit('teams-updated')

    // Show success message
    if (teamData?.name) {
      createSuccessMessage.value = t('teams.addModal.messages.createSuccess', { teamName: teamData.name })
    } else {
      createSuccessMessage.value = t('teams.addModal.messages.createSuccessGeneric')
    }
  } catch (error) {
    console.error('Error refreshing teams after creation:', error)
    createErrorMessage.value = t('teams.addModal.errors.refreshFailed')
  }
}

// Handle team creation error
const handleTeamCreationError = (errorMessage: string) => {
  // Clear any previous messages
  createSuccessMessage.value = null
  createErrorMessage.value = errorMessage
}

// Check for delete success message from query params
const checkDeleteSuccess = () => {
  const deletedTeamName = route.query.deleted as string
  if (deletedTeamName) {
    deleteSuccessMessage.value = t('teams.messages.deleteSuccess', { teamName: deletedTeamName })

    // Clear the query parameter from URL
    router.replace({ path: '/teams' })

    // Clear the message after 5 seconds
    setTimeout(() => {
      deleteSuccessMessage.value = null
    }, 5000)
  }
}

// Load data on component mount
onMounted(async () => {
  // Check for delete success message first
  checkDeleteSuccess()

  await Promise.all([
    checkPermissions(),
    fetchTeams(),
    initializeSelectedTeam()
  ])

  // Listen for team selection events from sidebar
  eventBus.on('team-selected', handleTeamSelectedFromSidebar)

  // Listen for team updates from other components
  eventBus.on('teams-updated', () => {
    fetchTeams(true) // Force refresh to get latest data
  })
})

onUnmounted(() => {
  // Clean up event listeners to prevent memory leaks
  eventBus.off('team-selected', handleTeamSelectedFromSidebar)
  eventBus.off('teams-updated')
})

</script>

<template>
  <DashboardLayout :title="t('teams.title')">
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <p class="text-muted-foreground">{{ t('teams.description') }}</p>
        </div>
        <Button
          @click="showAddModal = true"
          class="flex items-center gap-2"
        >
          <Plus class="h-4 w-4" />
          {{ t('teams.addButton') }}
        </Button>
      </div>

      <!-- Success Messages -->
      <Alert v-if="deleteSuccessMessage" class="border-green-200 bg-green-50 text-green-800">
        <CheckCircle class="h-4 w-4" />
        <AlertDescription>{{ deleteSuccessMessage }}</AlertDescription>
      </Alert>

      <Alert v-if="createSuccessMessage" class="border-green-200 bg-green-50 text-green-800">
        <CheckCircle class="h-4 w-4" />
        <AlertDescription>{{ createSuccessMessage }}</AlertDescription>
      </Alert>

      <!-- Error Messages -->
      <Alert v-if="createErrorMessage" class="border-red-200 bg-red-50 text-red-800">
        <AlertCircle class="h-4 w-4" />
        <AlertDescription>{{ createErrorMessage }}</AlertDescription>
      </Alert>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-muted-foreground">
        {{ t('teams.table.loading') }}
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-red-500">
        {{ t('teams.table.error', { error }) }}
      </div>

      <!-- Data Table -->
      <div v-else class="space-y-4">
        <!-- Search Input -->
        <div class="flex items-center py-4">
          <Input
            :placeholder="t('teams.table.search.placeholder')"
            v-model="searchQuery"
            class="max-w-sm"
          />
        </div>

        <!-- Teams Table Component -->
        <TeamTableColumns
          :teams="filteredTeams"
          :selected-team-id="selectedTeam?.id || null"
          :user-permissions="userPermissions"
          :on-manage-team="handleManageTeam"
          :on-switch-team="handleSwitchTeam"
        />
      </div>

      <!-- Add Team Modal -->
      <AddTeamModal
        v-model:open="showAddModal"
        @team-created="handleTeamCreated"
        @team-creation-error="handleTeamCreationError"
      />
    </div>
  </DashboardLayout>
</template>
