<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { GitBranch, CheckCircle } from 'lucide-vue-next'
import { DeploymentService } from '@/services/deploymentService'
import { useEventBus } from '@/composables/useEventBus'
import { toast } from 'vue-sonner'

const emit = defineEmits(['connected', 'next'])

const { t } = useI18n()
const eventBus = useEventBus()

const isLoading = ref(true)
const isConnected = ref(false)
const error = ref<string | null>(null)

async function checkConnection() {
  try {
    isLoading.value = true
    error.value = null

    const teamId = eventBus.getState<string>('selected_team_id')
    if (!teamId) {
      error.value = 'No team selected'
      return
    }

    const result = await DeploymentService.checkConnection(teamId)
    isConnected.value = result.connected

    if (result.connected) {
      emit('connected')
      // Auto-advance if already connected
      setTimeout(() => {
        emit('next')
      }, 500)
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to check connection'
    toast.error(t('deployments.notifications.connectionError'))
  } finally {
    isLoading.value = false
  }
}

function connectGitHub() {
  const teamId = eventBus.getState<string>('selected_team_id')
  if (!teamId) {
    toast.error('No team selected')
    return
  }

  // Redirects to GitHub App installation flow
  window.location.href = `${DeploymentService['baseUrl']}/api/teams/${teamId}/deploy/github/install`
}

onMounted(() => {
  checkConnection()
})
</script>

<template>
  <div class="space-y-6 py-8">
    <!-- Loading State -->
    <div v-if="isLoading" class="text-center">
      <Spinner class="h-12 w-12 mx-auto mb-4" />
      <p class="text-muted-foreground">{{ t('deployments.wizard.connectGitHub.checking') }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center">
      <div class="mx-auto max-w-md">
        <div class="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
          <p class="text-destructive font-semibold">{{ error }}</p>
          <Button
            v-if="!error.includes('not enabled')"
            @click="checkConnection"
            variant="outline"
            class="mt-4"
          >
            {{ t('deployments.wizard.selectRepository.tryAgain') }}
          </Button>
        </div>
      </div>
    </div>

    <!-- Connected State -->
    <div v-else-if="isConnected" class="text-center">
      <CheckCircle class="h-16 w-16 text-green-600 mx-auto mb-4" />
      <h2 class="text-xl font-semibold mb-2">{{ t('deployments.wizard.connectGitHub.connected') }}</h2>
      <p class="text-muted-foreground mb-6">{{ t('deployments.wizard.buttons.next') }}...</p>
    </div>

    <!-- Not Connected State -->
    <div v-else class="text-center">
      <div class="mb-6">
        <GitBranch class="h-20 w-20 mx-auto text-muted-foreground" />
      </div>

      <h2 class="text-2xl font-bold mb-2">{{ t('deployments.wizard.connectGitHub.title') }}</h2>
      <p class="text-muted-foreground mb-6">
        {{ t('deployments.wizard.connectGitHub.description') }}
      </p>

      <Button
        @click="connectGitHub"
        class="inline-flex items-center gap-2"
      >
        <GitBranch class="h-5 w-5" />
        {{ t('deployments.wizard.connectGitHub.button') }}
      </Button>

      <p class="text-xs text-muted-foreground mt-4">
        {{ t('deployments.wizard.connectGitHub.notice') }}
      </p>
    </div>
  </div>
</template>
