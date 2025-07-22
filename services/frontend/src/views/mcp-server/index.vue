<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-vue-next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DsAlert } from '@/components/ui/ds-alert'
import { CheckCircle } from 'lucide-vue-next'
import { useEventBus } from '@/composables/useEventBus'
import McpInstallationsCard from '@/components/mcp-server/McpInstallationsCard.vue'
import type { McpInstallation } from '@/types/mcp-installations'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { TeamService, type Team } from '@/services/teamService'

const { t } = useI18n()
const router = useRouter()
const eventBus = useEventBus()

// State
const installations = ref<McpInstallation[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const notificationMessage = ref<{ message: string; type: string } | null>(null)

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

// Methods
const fetchInstallations = async (): Promise<void> => {
  if (!selectedTeam.value) return

  try {
    isLoading.value = true
    error.value = null

    installations.value = await McpInstallationService.getTeamInstallations(selectedTeam.value.id)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    installations.value = []
  } finally {
    isLoading.value = false
  }
}

const handleInstallServer = () => {
  router.push('/mcp-server/add')
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

    // Show success message
    successMessage.value = t('mcpInstallations.removal.notifications.success')

    // Clear any existing error
    error.value = null

    // Emit event for other components
    eventBus.emit('mcp-installations-updated')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to remove installation'
  }
}


// Event handlers
const handleInstallationsUpdate = () => {
  fetchInstallations()
}

const handleNotificationShow = (data: { message: string; type: string }) => {
  notificationMessage.value = data
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const handleStorageChange = (data: { key: string; oldValue: any; newValue: any }) => {
  // Check if it's a pending notification
  if (data.key === 'pending_notification' && data.newValue) {
    // Display the notification
    notificationMessage.value = {
      message: data.newValue.message,
      type: data.newValue.type
    }

    // Clear the pending notification from storage
    eventBus.setState('pending_notification', null)
  }
}

const checkForPendingNotification = () => {
  const pendingNotification = eventBus.getState<{ message: string; type: string; timestamp: number }>('pending_notification')

  if (pendingNotification && pendingNotification.message && pendingNotification.type) {
    // Display the notification
    notificationMessage.value = {
      message: pendingNotification.message,
      type: pendingNotification.type
    }

    // Clear the pending notification from storage
    eventBus.setState('pending_notification', null)
  }
}

const dismissNotification = () => {
  notificationMessage.value = null
}

// Computed property for notification variant to avoid ESLint false positive
const notificationVariant = computed(() => {
  if (!notificationMessage.value) return 'default'
  return notificationMessage.value.type as 'success' | 'error' | 'warning' | 'info' | 'default'
})

// Lifecycle
onMounted(async () => {
  // Initialize team context first
  await initializeSelectedTeam()

  // Initial fetch after team is set
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
})

onUnmounted(() => {
  // Clean up event listeners to prevent memory leaks
  eventBus.off('team-selected', handleTeamSelected)
  eventBus.off('mcp-installations-updated', handleInstallationsUpdate)
  eventBus.off('notification-show', handleNotificationShow)
  eventBus.off('storage-changed', handleStorageChange)
})
</script>

<template>
  <DashboardLayout :title="t('mcpInstallations.title')">
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <p class="text-muted-foreground">{{ t('mcpInstallations.description') }}</p>
        </div>
        <Button
          v-if="selectedTeam"
          @click="handleInstallServer"
          class="flex items-center gap-2"
        >
          <Plus class="h-4 w-4" />
          {{ t('mcpInstallations.actions.install') }}
        </Button>
      </div>

      <!-- Success Message (old alert style, keeping for compatibility) -->
      <Alert v-if="successMessage" class="border-green-200 bg-green-50 text-green-800">
        <CheckCircle class="h-4 w-4" />
        <AlertDescription>{{ successMessage }}</AlertDescription>
      </Alert>

      <!-- Notification Alert (using DsAlert component) -->
      <DsAlert
        v-if="notificationMessage"
        :variant="notificationVariant"
        :description="notificationMessage.message"
        dismissible
        @dismiss="dismissNotification"
      />

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

      <!-- Main Content -->
      <div v-else>
        <McpInstallationsCard
          :installations="installations"
          :has-installations="hasInstallations"
          @install-server="handleInstallServer"
          @view-installation="handleViewInstallation"
          @manage-installation="handleManageInstallation"
          @remove-installation="handleRemoveInstallation"
        />
      </div>

    </div>
  </DashboardLayout>
</template>
