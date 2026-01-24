<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { CheckCircle, Eye, RefreshCw } from 'lucide-vue-next'
import { useEventBus } from '@/composables/useEventBus'

interface Props {
  installationId: string
  repositoryName: string
  branch: string
  commitSha: string
}

const props = defineProps<Props>()

const { t } = useI18n()
const router = useRouter()
const eventBus = useEventBus()

function handleViewInstallation() {
  const teamId = eventBus.getState<string>('selected_team_id')
  if (!teamId) {
    console.error('No team selected')
    return
  }
  router.push(`/teams/${teamId}/mcp/installations/${props.installationId}`)
}

function handleDeployAnother() {
  router.push('/deploy/create')
}
</script>

<template>
  <div class="space-y-6 py-8 text-center">
    <!-- Success Icon -->
    <CheckCircle class="h-20 w-20 text-green-600 mx-auto" />

    <h2 class="text-2xl font-bold text-green-600">{{ t('deployments.wizard.success.title') }}</h2>

    <!-- Deployment Details Box -->
    <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 max-w-md mx-auto text-left">
      <h3 class="font-semibold mb-4 text-green-900 dark:text-green-100">{{ t('deployments.wizard.success.detailsTitle') }}</h3>
      <div class="space-y-2 text-sm">
        <div class="flex justify-between">
          <span class="text-muted-foreground">{{ t('deployments.wizard.success.repository') }}:</span>
          <span class="font-mono font-medium">{{ repositoryName }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">{{ t('deployments.wizard.success.branch') }}:</span>
          <span class="font-mono font-medium">{{ branch }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">{{ t('deployments.wizard.success.commitSha') }}:</span>
          <span class="font-mono text-xs">{{ commitSha.substring(0, 8) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">{{ t('deployments.wizard.success.status') }}:</span>
          <span class="text-green-600 font-semibold">{{ t('deployments.wizard.success.online') }}</span>
        </div>
      </div>
    </div>

    <p class="text-muted-foreground">
      {{ t('deployments.wizard.success.description') }}
    </p>

    <!-- Action Buttons -->
    <div class="flex justify-center gap-4">
      <Button
        @click="handleViewInstallation"
        variant="default"
        class="inline-flex items-center gap-2"
      >
        <Eye class="h-4 w-4" />
        {{ t('deployments.wizard.success.viewInstallation') }}
      </Button>
      <Button
        @click="handleDeployAnother"
        variant="outline"
        class="inline-flex items-center gap-2"
      >
        <RefreshCw class="h-4 w-4" />
        {{ t('deployments.wizard.success.deployAnother') }}
      </Button>
    </div>
  </div>
</template>
