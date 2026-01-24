<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { DsPageHeading } from '@/components/ui/ds-page-heading'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Settings } from 'lucide-vue-next'
import DeploymentEmptyState from '@/components/deploy/DeploymentEmptyState.vue'
import { useInstallationsStream } from '@/composables/mcp-server'
import McpInstallationsCard from '@/components/mcp-server/McpInstallationsCard.vue'
import { useEventBus } from '@/composables/useEventBus'
import { toast } from 'vue-sonner'
import { getEnv } from '@/utils/env'

const { t } = useI18n()
const router = useRouter()
const eventBus = useEventBus()

// SSE Stream for GitHub deployments only
const {
  installations: deployments,
  isLoading,
  error,
  connect: connectDeploymentsStream,
  disconnect: disconnectDeploymentsStream
} = useInstallationsStream()

const featureDisabled = ref(false)
const currentTeamId = ref<string | null>(null)

// Computed
const hasDeployments = computed(() => deployments.value.length > 0)

async function connectToDeployments() {
  if (!currentTeamId.value) {
    return
  }

  try {
    const baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')
    // Connect to SSE stream with source=github filter
    const url = `${baseUrl}/api/teams/${currentTeamId.value}/mcp/installations/stream?source=github`
    connectDeploymentsStream(url)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to load deployments'

    // Check if feature is disabled
    if (errorMessage.includes('not enabled')) {
      featureDisabled.value = true
    } else {
      toast.error('Failed to load deployments', {
        description: errorMessage
      })
    }
  }
}

function handleDeployNew() {
  router.push('/deploy/create')
}

function handleViewInstallation(installationId: string) {
  router.push(`/mcp-server/installation/${installationId}/general`)
}

function handleManageInstallation() {
  // TODO: Implement manage functionality
}

function handleRemoveInstallation(installationId: string) {
  // Remove from local state (the actual API call is handled by the modal)
  deployments.value = deployments.value.filter(inst => inst.id !== installationId)
  toast.success(t('deployments.notifications.removeSuccess'))
  // Emit event for other components
  eventBus.emit('mcp-installations-updated')
}

function handleTeamSelected(data: { teamId: string }) {
  currentTeamId.value = data.teamId
  // Reconnect stream for new team
  if (currentTeamId.value) {
    connectToDeployments()
  }
}

onMounted(async () => {
  // Initialize team context from event bus storage
  const storedTeamId = eventBus.getState<string>('selected_team_id')
  currentTeamId.value = storedTeamId

  // Connect to deployments stream
  if (currentTeamId.value) {
    connectToDeployments()
  }

  // Listen for team selection changes
  eventBus.on('team-selected', handleTeamSelected)
})

onUnmounted(() => {
  // Disconnect SSE stream
  disconnectDeploymentsStream()

  // Clean up event listeners
  eventBus.off('team-selected', handleTeamSelected)
})
</script>

<template>
  <NavbarLayout>
    <DsPageHeading :title="t('deployments.listTitle')">
      <template #actions>
        <Button v-if="currentTeamId" @click="handleDeployNew" class="flex items-center gap-2">
          {{ t('deployments.actions.deployNew') }}
        </Button>
      </template>
    </DsPageHeading>

    <div class="space-y-6 mt-6">
      <!-- No team selected state -->
      <div v-if="!currentTeamId" class="text-center py-12">
        <p class="text-muted-foreground">{{ t('mcpInstallations.teamContext.noTeamSelected') }}</p>
      </div>

      <!-- Loading State -->
      <div v-else-if="isLoading" class="text-muted-foreground">
        {{ t('mcpInstallations.table.loading') }}
      </div>

      <!-- Feature Disabled State -->
      <Empty v-else-if="featureDisabled">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Settings />
          </EmptyMedia>
          <EmptyTitle>Deployment Feature Disabled</EmptyTitle>
          <EmptyDescription>
            The GitHub deployment feature is not enabled. Please contact your DeployStack administrator to enable this feature in Global Settings.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>

      <!-- Error State -->
      <div v-else-if="error" class="text-red-500">
        {{ t('common.messages.error') }}: {{ error }}
      </div>

      <!-- Empty State -->
      <DeploymentEmptyState
        v-else-if="!hasDeployments"
        @deploy-new="handleDeployNew"
      />

      <!-- Deployments List -->
      <div v-else class="mx-auto max-w-3xl">
        <McpInstallationsCard
          :installations="deployments"
          @view-installation="handleViewInstallation"
          @manage-installation="handleManageInstallation"
          @remove-installation="handleRemoveInstallation"
        />
      </div>
    </div>
  </NavbarLayout>
</template>
