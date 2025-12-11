<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { useEventBus } from '@/composables/useEventBus'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import McpInstallationsCard from '@/components/mcp-server/McpInstallationsCard.vue'
import McpInstallationsEmptyState from '@/components/mcp-server/McpInstallationsEmptyState.vue'
import McpClientConnectionsCard from '@/components/mcp-server/McpClientConnectionsCard.vue'
import McpStats from '@/components/mcp-server/McpStats.vue'
import ClientConfigurationModal from '@/components/gateway-config/ClientConfigurationModal.vue'
import UserWalkthroughPopover from '@/components/walkthrough/UserWalkthroughPopover.vue'
import TeamUsageIndicator from '@/components/teams/TeamUsageIndicator.vue'
import type { McpInstallation } from '@/types/mcp-installations'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { TeamService, type Team } from '@/services/teamService'
import { GlobalSettingsService } from '@/services/globalSettingsService'
import { UserPreferencesService } from '@/services/userPreferencesService'

const { t } = useI18n()
const router = useRouter()
const eventBus = useEventBus()
const { setBreadcrumbs } = useBreadcrumbs()

// State
const installations = ref<McpInstallation[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

// Walkthrough state
const showUserWalkthrough = ref(false)
const walkthroughStep = ref(1)
const showWalkthroughStep2 = ref(false)
const showStep2ButtonHighZIndex = ref(false)

// Team context using event bus storage
const selectedTeam = ref<Team | null>(null)

// Gateway configuration modal state
const isConfigModalOpen = ref(false)

// Computed
const hasInstallations = computed(() => installations.value.length > 0)

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

    fetchInstallations() // Reload installations for new team
  } catch (error) {
    console.error('Error handling team selection:', error)
    selectedTeam.value = { id: data.teamId, name: data.teamName } as Team
    fetchInstallations()
  }
}

// UPDATED: Check walkthrough setting and user completion status
const checkWalkthroughSetting = async (): Promise<boolean> => {
  try {
    // Step 1: Check if walkthrough is globally enabled
    const globalWalkthroughEnabled = await GlobalSettingsService.shouldShowUserWalkthrough()

    if (!globalWalkthroughEnabled) {
      return false
    }

    // Step 2: Check user's personal walkthrough completion status via API
    const userPreferences = await UserPreferencesService.getUserPreferences()
    const isWalkthroughCompleted = userPreferences.walkthrough_completed || false

    if (isWalkthroughCompleted) {
      // Also sync to local storage for consistency
      eventBus.setState('walkthrough_completed', true)
      return false
    }

    // Step 3: Return true if walkthrough should be shown
    return true

  } catch (error) {
    console.error('Error checking walkthrough setting:', error)
    return false
  }
}

// Methods
const fetchInstallations = async (): Promise<void> => {
  if (!selectedTeam.value) return

  try {
    isLoading.value = true
    error.value = null

    installations.value = await McpInstallationService.getTeamInstallations(selectedTeam.value.id)

    // UPDATED: Check and show walkthrough after installations are loaded
    await checkAndShowWalkthrough()

  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    installations.value = []
  } finally {
    isLoading.value = false
  }
}

// Check and show walkthrough with proper timing
const checkAndShowWalkthrough = async (): Promise<void> => {
  try {
    // Only show walkthrough if there are installations to highlight
    if (installations.value.length === 0) {
      showUserWalkthrough.value = false
      return
    }

    // Check if walkthrough should be shown
    const shouldShowWalkthrough = await checkWalkthroughSetting()

    if (!shouldShowWalkthrough) {
      showUserWalkthrough.value = false
      return
    }

    // Wait for DOM to update with the installations list
    await nextTick()

    // Add a small delay to ensure the list is fully rendered
    setTimeout(() => {
      // Verify the target element exists before showing walkthrough
      const targetElement = document.getElementById('last-server-item')
      if (targetElement) {
        showUserWalkthrough.value = true
        // Emit step 1 active after showing walkthrough
        eventBus.emit('walkthrough-step1-active')
      } else {
        console.warn('Target element "last-server-item" not found, skipping walkthrough')
        showUserWalkthrough.value = false
      }
    }, 100)

  } catch (error) {
    console.error('Error checking and showing walkthrough:', error)
    showUserWalkthrough.value = false
  }
}

const handleInstallServer = () => {
  router.push('/mcp-server/install')
}

const handleOpenConfigModal = () => {
  // If walkthrough step 2 is active, finish the walkthrough
  if (showWalkthroughStep2.value) {
    handleWalkthroughFinish()
  }

  isConfigModalOpen.value = true
}

const handleViewInstallation = (serverId: string) => {
  router.push(`/mcp-server/view/${serverId}`)
}

const handleManageInstallation = () => {
  // TODO: Implement manage functionality
}

const handleRemoveInstallation = async (installationId: string) => {
  try {
    // Remove from local state (the actual API call is handled by the modal)
    installations.value = installations.value.filter(inst => inst.id !== installationId)

    // Show success toast
    toast.success(t('mcpInstallations.notifications.removeSuccess'))

    // Clear any existing error
    error.value = null

    // Emit event for other components
    eventBus.emit('mcp-installations-updated')
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to remove installation'
    error.value = errorMessage
    toast.error(t('mcpInstallations.notifications.removeError'), {
      description: errorMessage
    })
  }
}


// Event handlers
const handleInstallationsUpdate = () => {
  fetchInstallations()
}

const handleNotificationShow = (data: { message: string; type: string }) => {
  // Convert event bus notifications to Sonner toasts
  switch (data.type) {
    case 'success':
      toast.success(data.message)
      break
    case 'error':
      toast.error(data.message)
      break
    case 'warning':
      toast.warning(data.message)
      break
    default:
      toast(data.message)
  }
}


// Walkthrough event handlers
const handleWalkthroughNextStep = (data: { fromStep: number; toStep: number }) => {
  if (data.fromStep === 1 && data.toStep === 2) {
    // Hide step 1
    showUserWalkthrough.value = false
    walkthroughStep.value = 2

    // Emit step 2 active to control z-index
    eventBus.emit('walkthrough-step2-active')

    // Show step 2 after a brief delay
    setTimeout(() => {
      showWalkthroughStep2.value = true
      showStep2ButtonHighZIndex.value = true
    }, 300)
  }
}

// UPDATED: Enhanced walkthrough finish handler with API call
const handleWalkthroughFinish = async () => {
  try {
    // Step 1: Use generic preference endpoint (avoids Content-Type header issue)
    await UserPreferencesService.setUserPreference('walkthrough_completed', true)

    // Step 2: Update local storage for consistency
    eventBus.setState('walkthrough_completed', true)

    // Step 3: Hide all walkthrough UI elements
    showUserWalkthrough.value = false
    showWalkthroughStep2.value = false
    showStep2ButtonHighZIndex.value = false
    walkthroughStep.value = 1

    // Step 4: Emit completion event for any listening components
    eventBus.emit('walkthrough-completed')

    // Optional: Show success toast
    toast.success('Welcome tour completed!')

  } catch (error) {
    console.error('Error updating walkthrough completion status:', error)

    // Still update local storage as fallback
    eventBus.setState('walkthrough_completed', true)

    // Hide walkthrough UI
    showUserWalkthrough.value = false
    showWalkthroughStep2.value = false
    showStep2ButtonHighZIndex.value = false
    walkthroughStep.value = 1

    // Emit completion event
    eventBus.emit('walkthrough-completed')

    // Show error toast
    toast.error('Walkthrough completed, but failed to save preference')
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleStorageChange = (data: { key: string; oldValue: any; newValue: any }) => {
  // Check if it's a pending notification
  if (data.key === 'pending_notification' && data.newValue) {
    // Display the notification using Sonner
    const notification = data.newValue
    switch (notification.type) {
      case 'success':
        toast.success(notification.message)
        break
      case 'error':
        toast.error(notification.message)
        break
      case 'warning':
        toast.warning(notification.message)
        break
      default:
        toast(notification.message)
    }

    // Clear the pending notification from storage
    eventBus.setState('pending_notification', null)
  }
}

const checkForPendingNotification = () => {
  const pendingNotification = eventBus.getState<{ message: string; type: string; timestamp: number }>('pending_notification')

  if (pendingNotification && pendingNotification.message && pendingNotification.type) {
    // Display the notification using Sonner
    switch (pendingNotification.type) {
      case 'success':
        toast.success(pendingNotification.message)
        break
      case 'error':
        toast.error(pendingNotification.message)
        break
      case 'warning':
        toast.warning(pendingNotification.message)
        break
      default:
        toast(pendingNotification.message)
    }

    // Clear the pending notification from storage
    eventBus.setState('pending_notification', null)
  }
}



// Lifecycle
onMounted(async () => {
  // Set breadcrumbs
  setBreadcrumbs([{ label: t('sidebar.navigation.dashboard') }])

  // Initialize team context first
  await initializeSelectedTeam()

  // Initial fetch after team is set (walkthrough will be handled after installations load)
  if (selectedTeam.value) {
    await fetchInstallations()
  }

  // Check for pending notifications from storage
  checkForPendingNotification()

  // Listen for team selection events from sidebar
  eventBus.on('team-selected', handleTeamSelected)

  // Listen for installation updates
  eventBus.on('mcp-installations-updated', handleInstallationsUpdate)

  // Listen for notification events (for backward compatibility)
  eventBus.on('notification-show', handleNotificationShow)

  // Listen for storage changes (for persistent notifications)
  eventBus.on('storage-changed', handleStorageChange)

  // Listen for walkthrough events
  eventBus.on('walkthrough-next-step', handleWalkthroughNextStep)
  eventBus.on('walkthrough-finish', handleWalkthroughFinish)
})

onUnmounted(() => {
  // Clean up event listeners to prevent memory leaks
  eventBus.off('team-selected', handleTeamSelected)
  eventBus.off('mcp-installations-updated', handleInstallationsUpdate)
  eventBus.off('notification-show', handleNotificationShow)
  eventBus.off('storage-changed', handleStorageChange)
  eventBus.off('walkthrough-next-step', handleWalkthroughNextStep)
  eventBus.off('walkthrough-finish', handleWalkthroughFinish)
})
</script>

<template>
  <NavbarLayout>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex-1">
          <TeamUsageIndicator v-if="selectedTeam" :team-id="selectedTeam.id" />
        </div>
        <div v-if="selectedTeam" class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Button
            id="get-configuration-button"
            @click="handleOpenConfigModal"
            variant="outline"
            :class="[
              'flex items-center justify-center gap-2 bg-black text-white border-black hover:bg-black/90 hover:border-black hover:text-white',
              showStep2ButtonHighZIndex ? 'relative z-[10000]' : ''
            ]"
          >
            {{ t('satelliteConfig.button.getConfiguration') }}
          </Button>
          <Button
            @click="handleInstallServer"
            class="flex items-center justify-center gap-2"
          >
            <Plus class="h-4 w-4" />
            {{ t('mcpInstallations.actions.install') }}
          </Button>
        </div>
      </div>



      <!-- No team selected state -->
      <div v-if="!selectedTeam" class="text-center py-12">
        <p class="text-muted-foreground">{{ t('mcpInstallations.teamContext.noTeamSelected') }}</p>
      </div>

      <!-- Loading State -->
      <div v-else-if="isLoading" class="text-muted-foreground">
        {{ t('mcpInstallations.table.loading') }}
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-red-500">
        {{ t('common.messages.error') }}: {{ error }}
      </div>

      <!-- Empty State - No installations -->
      <McpInstallationsEmptyState
        v-else-if="!hasInstallations"
        @install-server="handleInstallServer"
      />

      <!-- Main Content - Has installations -->
      <div v-else>
        <McpStats />

        <div class="flex flex-col-reverse sm:flex-row gap-6 mt-18">
          <div class="sm:flex-[0.7]">
            <McpInstallationsCard
              :installations="installations"
              :show-walkthrough="showUserWalkthrough"
              @view-installation="handleViewInstallation"
              @manage-installation="handleManageInstallation"
              @remove-installation="handleRemoveInstallation"
            />
          </div>
          <div class="sm:flex-[0.3]">
            <McpClientConnectionsCard />
          </div>
        </div>
      </div>

    </div>

    <!-- Gateway Configuration Modal -->
    <ClientConfigurationModal
      v-model:open="isConfigModalOpen"
    />

    <!-- Walkthrough Step 1 Popover -->
    <UserWalkthroughPopover
      v-model:open="showUserWalkthrough"
      :step="1"
      target-element="last-server-item"
    />

    <!-- Walkthrough Step 2 Popover -->
    <UserWalkthroughPopover
      v-model:open="showWalkthroughStep2"
      :step="2"
      target-element="get-configuration-button"
    />
  </NavbarLayout>
</template>
