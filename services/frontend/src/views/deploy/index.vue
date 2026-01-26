<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
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
import { useTeamContext } from '@/composables/useTeamContext'
import { toast } from 'vue-sonner'
import { getEnv } from '@/utils/env'

const { t } = useI18n()
const router = useRouter()
const eventBus = useEventBus()

// Team context using composable
const { selectedTeam, teamId, hasTeam, allowGithubMcp } = useTeamContext()

// SSE Stream for GitHub deployments only
const {
  installations: deployments,
  isLoading,
  error,
  connect: connectDeploymentsStream,
  disconnect: disconnectDeploymentsStream
} = useInstallationsStream()

const featureDisabled = ref(false)

// Computed
const hasDeployments = computed(() => deployments.value.length > 0)

async function connectToDeployments() {
  if (!teamId.value) {
    return
  }

  // Check team permission first
  if (!allowGithubMcp.value) {
    featureDisabled.value = true
    return
  }

  // Reset feature disabled flag if permission is granted
  featureDisabled.value = false

  try {
    const baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')
    // Connect to SSE stream with source=github filter
    const url = `${baseUrl}/api/teams/${teamId.value}/mcp/installations/stream?source=github`
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

// Watch for team changes to reconnect stream
watch(selectedTeam, (newTeam) => {
  if (newTeam) {
    connectToDeployments()
  }
})

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

onMounted(async () => {
  // Connect to deployments stream (watch on selectedTeam handles reconnections)
  if (teamId.value) {
    connectToDeployments()
  }
})

onUnmounted(() => {
  // Disconnect SSE stream
  disconnectDeploymentsStream()
})
</script>

<template>
  <NavbarLayout>
    <DsPageHeading :title="t('deployments.listTitle')">
      <template #actions>
        <Button v-if="hasTeam && allowGithubMcp" @click="handleDeployNew" class="flex items-center gap-2">
          {{ t('deployments.actions.deployNew') }}
        </Button>
      </template>
    </DsPageHeading>

    <div class="space-y-6 mt-6">
      <!-- No team selected state -->
      <div v-if="!hasTeam" class="text-center py-12">
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
          <EmptyTitle>GitHub Deployments Not Allowed</EmptyTitle>
          <EmptyDescription>
            GitHub MCP deployments are not enabled for this team. Please contact your team administrator or upgrade your team plan to enable this feature.
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
