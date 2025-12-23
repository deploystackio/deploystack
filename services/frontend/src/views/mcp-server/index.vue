<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { DsPageHeading } from '@/components/ui/ds-page-heading'
import { Button } from '@/components/ui/button'
import { toast } from 'vue-sonner'
import { useEventBus } from '@/composables/useEventBus'
import { useInstallationsStream } from '@/composables/mcp-server'
import McpInstallationsCard from '@/components/mcp-server/McpInstallationsCard.vue'
import McpInstallationsEmptyState from '@/components/mcp-server/McpInstallationsEmptyState.vue'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { TeamService, type Team } from '@/services/teamService'
import TeamUsageIndicator from '@/components/teams/TeamUsageIndicator.vue'

const { t } = useI18n()
const router = useRouter()
const eventBus = useEventBus()

// SSE Stream for installations
const {
  installations,
  isLoading,
  error,
  connect: connectInstallationsStream,
  disconnect: disconnectInstallationsStream
} = useInstallationsStream()

// Team context using event bus storage
const selectedTeam = ref<Team | null>(null)

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

    // Reconnect stream for new team
    if (selectedTeam.value) {
      const url = McpInstallationService.getStreamUrl(selectedTeam.value.id)
      connectInstallationsStream(url)
    }
  } catch (error) {
    console.error('Error handling team selection:', error)
    selectedTeam.value = { id: data.teamId, name: data.teamName } as Team

    // Reconnect stream for new team even if team fetch failed
    if (selectedTeam.value) {
      const url = McpInstallationService.getStreamUrl(selectedTeam.value.id)
      connectInstallationsStream(url)
    }
  }
}

const handleInstallServer = () => {
  router.push('/mcp-server/install')
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
  // Stream will automatically receive updates
  // This handler can now trigger UI notifications if needed
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
  // Initialize team context first
  await initializeSelectedTeam()

  // Connect SSE stream
  if (selectedTeam.value) {
    const url = McpInstallationService.getStreamUrl(selectedTeam.value.id)
    connectInstallationsStream(url)
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
})

onUnmounted(() => {
  // Disconnect SSE stream
  disconnectInstallationsStream()

  // Clean up event listeners to prevent memory leaks
  eventBus.off('team-selected', handleTeamSelected)
  eventBus.off('mcp-installations-updated', handleInstallationsUpdate)
  eventBus.off('notification-show', handleNotificationShow)
  eventBus.off('storage-changed', handleStorageChange)
})
</script>

<template>
  <NavbarLayout>
    <DsPageHeading :title="t('mcpInstallations.title')">
      <template #actions>
        <Button
          v-if="selectedTeam"
          @click="handleInstallServer"
          class="flex items-center gap-2"
        >
          {{ t('mcpInstallations.featuredList.browseCatalog') }}
        </Button>
      </template>
    </DsPageHeading>

    <div class="space-y-6 mt-6">
      <!-- Team Usage Indicator -->
      <TeamUsageIndicator v-if="selectedTeam" :team-id="selectedTeam.id" />

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
      <div v-else class="mx-auto max-w-3xl">
        <McpInstallationsCard
          :installations="installations"
          @view-installation="handleViewInstallation"
          @manage-installation="handleManageInstallation"
          @remove-installation="handleRemoveInstallation"
        />
      </div>

    </div>
  </NavbarLayout>
</template>
