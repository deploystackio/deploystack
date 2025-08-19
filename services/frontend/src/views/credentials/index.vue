<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Search, CheckCircle } from 'lucide-vue-next'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { CredentialsService } from '@/services/credentialsService'
import { UserService } from '@/services/userService'
import { TeamService, type Team } from '@/services/teamService'
import { useEventBus } from '@/composables/useEventBus'
import type { CloudCredential, CloudCredentialBasic } from './types'
import CredentialsTable from '@/components/credentials/CredentialsTable.vue'
import AddCredentialDialog from '@/components/credentials/AddCredentialDialog.vue'


// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: ReturnType<typeof setTimeout>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((...args: any[]) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }) as T
}

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const eventBus = useEventBus()

// State
const credentials = ref<CloudCredential[]>([])
const searchResults = ref<CloudCredentialBasic[]>([])
const isLoading = ref(true)
const isSearching = ref(false)
const isCreating = ref(false)
const error = ref<string | null>(null)
const showAddModal = ref(false)
const canCreateCredentials = ref(false)
const userPermissions = ref<string[]>([])
const searchQuery = ref('')
const deleteSuccessMessage = ref<string | null>(null)

// Team context using event bus storage
const selectedTeam = ref<Team | null>(null)

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
          if (defaultTeam) {
            selectedTeam.value = defaultTeam
            eventBus.setState('selected_team_id', defaultTeam.id)
          }
        }
      } else {
        // No stored team, use default team
        const defaultTeam = userTeams.find(team => team.is_default) || userTeams[0]
        if (defaultTeam) {
          selectedTeam.value = defaultTeam
          eventBus.setState('selected_team_id', defaultTeam.id)
        }
      }
    }
  } catch (error) {
    console.error('Error initializing selected team:', error)
  }
}

// Handle team selection from sidebar
const handleTeamSelected = async (data: { teamId: string; teamName: string }) => {
  // Find the full team object with role information
  try {
    const userTeams = await TeamService.getUserTeams()
    const fullTeam = userTeams.find(t => t.id === data.teamId)
    if (fullTeam) {
      selectedTeam.value = fullTeam
    } else {
      selectedTeam.value = { id: data.teamId, name: data.teamName } as Team
    }

    fetchCredentials() // Reload credentials for new team
    checkTeamPermissions() // Check permissions for new team
  } catch (error) {
    console.error('Error handling team selection:', error)
    selectedTeam.value = { id: data.teamId, name: data.teamName } as Team
    fetchCredentials()
  }
}

// Check user permissions
const checkPermissions = async () => {
  try {
    const user = await UserService.getCurrentUser()
    if (user?.role?.permissions) {
      // Global admins can always create credentials
      const isGlobalAdmin = user.role.permissions.includes('system.admin')
      canCreateCredentials.value = isGlobalAdmin
      userPermissions.value = user.role.permissions
    }
  } catch (error) {
    console.error('Error checking permissions:', error)
    canCreateCredentials.value = false
    userPermissions.value = []
  }
}

// Check team-specific permissions using the role info from teams data
const checkTeamPermissions = () => {
  if (!selectedTeam.value) return

  // Check if user is team admin for the selected team
  const isTeamAdmin = selectedTeam.value.is_admin || selectedTeam.value.role === 'team_admin'
  const isGlobalAdmin = userPermissions.value.includes('system.admin')

  canCreateCredentials.value = isTeamAdmin || isGlobalAdmin
}

// Fetch credentials from API
const fetchCredentials = async (): Promise<void> => {
  if (!selectedTeam.value) return

  try {
    isLoading.value = true
    error.value = null

    credentials.value = await CredentialsService.getTeamCredentials(selectedTeam.value.id)
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('common.error')
    credentials.value = []
  } finally {
    isLoading.value = false
  }
}

// Debounced search
const debouncedSearch = debounce(async (query: string) => {
  if (!selectedTeam.value || !query.trim()) {
    searchResults.value = []
    return
  }

  try {
    isSearching.value = true
    searchResults.value = await CredentialsService.searchCredentials(
      selectedTeam.value.id,
      query.trim()
    )
  } catch (error) {
    console.error('Search error:', error)
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}, 300)

// Manual search function for button click
const handleManualSearch = async () => {
  if (!selectedTeam.value || !searchQuery.value.trim()) {
    searchResults.value = []
    return
  }

  try {
    isSearching.value = true
    searchResults.value = await CredentialsService.searchCredentials(
      selectedTeam.value.id,
      searchQuery.value.trim()
    )
  } catch (error) {
    console.error('Search error:', error)
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

// Watch search query
watch(searchQuery, (newQuery) => {
  if (newQuery.trim()) {
    debouncedSearch(newQuery)
  } else {
    searchResults.value = []
  }
})

// Display data: use search results if searching, otherwise all credentials
const displayCredentials = computed(() => {
  return searchQuery.value.trim() ? searchResults.value : credentials.value
})

// Handle credential actions
const handleManageCredential = (credentialId: string) => {
  // Navigate to credential detail page
  router.push(`/credentials/${credentialId}`)
}

// Handle credential creation success
const handleCredentialCreated = async () => {
  await fetchCredentials()
  // Emit global event to update other components
  eventBus.emit('credentials-updated')
}

// Handle add credential button click
const handleAddCredential = () => {
  isCreating.value = true
  showAddModal.value = true
}

// Handle modal close
const handleModalClose = () => {
  isCreating.value = false
  showAddModal.value = false
}

// Check for delete success message from query params
const checkDeleteSuccess = () => {
  const deletedCredentialName = route.query.deleted as string
  if (deletedCredentialName) {
    deleteSuccessMessage.value = t('credentials.delete.success', { name: deletedCredentialName })

    // Clear the query parameter from URL
    router.replace({ path: '/credentials' })
  }
}

// Load data on component mount
onMounted(async () => {
  // Check for delete success message first
  checkDeleteSuccess()

  await Promise.all([
    checkPermissions(),
    initializeSelectedTeam()
  ])

  // Initial fetch after team is set
  if (selectedTeam.value) {
    await fetchCredentials()
    await checkTeamPermissions()
  }

  // Listen for team selection events from sidebar
  eventBus.on('team-selected', handleTeamSelected)

  // Listen for credential updates from other components
  eventBus.on('credentials-updated', () => {
    fetchCredentials() // Force refresh to get latest data
  })
})

onUnmounted(() => {
  // Clean up event listeners to prevent memory leaks
  eventBus.off('team-selected', handleTeamSelected)
  eventBus.off('credentials-updated')
})

</script>

<template>
  <DashboardLayout :title="t('credentials.title')">
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex-1">
          <p class="text-muted-foreground">{{ t('credentials.description') }}</p>
        </div>
        <Button
          v-if="canCreateCredentials && selectedTeam"
          @click="handleAddCredential"
          :loading="isCreating"
          :loading-text="t('credentials.actions.creating')"
          class="flex items-center justify-center gap-2"
        >
          <Plus class="h-4 w-4" />
          {{ t('credentials.addButton') }}
        </Button>
      </div>

      <!-- Delete Success Message -->
      <Alert v-if="deleteSuccessMessage" class="border-green-200 bg-green-50 text-green-800">
        <CheckCircle class="h-4 w-4" />
        <AlertDescription>{{ deleteSuccessMessage }}</AlertDescription>
      </Alert>

      <!-- No team selected state -->
      <div v-if="!selectedTeam" class="text-center py-12">
        <p class="text-muted-foreground">{{ t('credentials.permissions.noAccess') }}</p>
      </div>

      <!-- Loading State -->
      <div v-else-if="isLoading" class="text-muted-foreground">
        {{ t('credentials.table.loading') }}
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-red-500">
        {{ t('credentials.table.error', { error }) }}
      </div>

      <!-- Data Table -->
      <div v-else class="space-y-4">
        <!-- Search Input with Button -->
        <div class="flex items-center py-4">
          <div class="flex w-full sm:max-w-sm">
            <Input
              :placeholder="t('credentials.search.placeholder')"
              v-model="searchQuery"
              class="rounded-r-none border-r-0 focus:z-10"
              @keyup.enter="handleManualSearch"
            />
            <Button
              variant="outline"
              class="rounded-l-none border-l-0 px-3"
              @click="handleManualSearch"
              :loading="isSearching"
              :loading-text="t('credentials.search.searching')"
            >
              <Search class="h-4 w-4" />
              <span class="sr-only">{{ t('credentials.search.button') }}</span>
            </Button>
          </div>
        </div>

        <!-- Search results count -->
        <div v-if="searchQuery.trim()" class="text-sm text-muted-foreground">
          {{ t('credentials.search.results', {
            count: searchResults.length,
            query: searchQuery
          }) }}
        </div>

        <!-- Empty state -->
        <div v-if="displayCredentials.length === 0 && !searchQuery.trim()" class="text-center py-12">
          <div class="space-y-4">
            <h3 class="text-lg font-medium">{{ t('credentials.empty.title') }}</h3>
            <p class="text-muted-foreground">{{ t('credentials.empty.description') }}</p>
          </div>
        </div>

        <!-- Table -->
        <CredentialsTable
          v-if="displayCredentials.length > 0"
          :credentials="displayCredentials"
          :on-manage="handleManageCredential"
        />

        <!-- No results state -->
        <div v-else-if="searchQuery.trim()" class="text-center py-12">
          <p class="text-muted-foreground">{{ t('credentials.search.noResults') }}</p>
        </div>
      </div>

      <!-- Add Credential Dialog -->
      <AddCredentialDialog
        v-model:open="showAddModal"
        :team-id="selectedTeam?.id"
        @credential-created="handleCredentialCreated"
        @update:open="(open) => { if (!open) handleModalClose() }"
      />
    </div>
  </DashboardLayout>
</template>
