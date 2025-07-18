<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-vue-next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle } from 'lucide-vue-next'
import { useEventBus } from '@/composables/useEventBus'
import McpInstallationsCard from '@/components/mcp-server/McpInstallationsCard.vue'
import type { McpInstallation } from '@/types/mcp-installations'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { TeamService } from '@/services/teamService'

const { t } = useI18n()
const router = useRouter()
const eventBus = useEventBus()

// State
const installations = ref<McpInstallation[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)

// Computed
const hasInstallations = computed(() => installations.value.length > 0)

// Methods
const fetchInstallations = async (): Promise<void> => {
  try {
    isLoading.value = true
    error.value = null

    // Get user's teams
    const userTeams = await TeamService.getUserTeams()

    // Fetch installations from all teams
    const allInstallations: McpInstallation[] = []

    for (const team of userTeams) {
      try {
        const teamInstallations = await McpInstallationService.getTeamInstallations(team.id)
        allInstallations.push(...teamInstallations)
      } catch {
        // Continue with other teams if one fails
        continue
      }
    }

    installations.value = allInstallations
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

// Lifecycle
onMounted(async () => {
  await fetchInstallations()

  // Listen for installation updates
  eventBus.on('mcp-installations-updated', handleInstallationsUpdate)
})

onUnmounted(() => {
  // Clean up event listeners
  eventBus.off('mcp-installations-updated', handleInstallationsUpdate)
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
          @click="handleInstallServer"
          class="flex items-center gap-2"
        >
          <Plus class="h-4 w-4" />
          {{ t('mcpInstallations.actions.install') }}
        </Button>
      </div>

      <!-- Success Message -->
      <Alert v-if="successMessage" class="border-green-200 bg-green-50 text-green-800">
        <CheckCircle class="h-4 w-4" />
        <AlertDescription>{{ successMessage }}</AlertDescription>
      </Alert>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-muted-foreground">
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
