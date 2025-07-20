<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useEventBus } from '@/composables/useEventBus'
import DashboardLayout from '@/components/DashboardLayout.vue'
import McpServerInstallWizard from '@/components/mcp-server/wizard/McpServerInstallWizard.vue'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const eventBus = useEventBus()


// Navigation
const goBack = () => {
  router.push('/mcp-server')
}

// Handle wizard completion
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleWizardComplete = (installationData: any) => {
  // console.log('Installation completed:', installationData)

  // Emit events for other components to update
  eventBus.emit('mcp-installations-updated')
  eventBus.emit('notification-show', {
    message: t('mcpInstallations.wizard.success.installed', { name: installationData.installation_name }),
    type: 'success'
  })

  // Navigate back to main page
  router.push('/mcp-server')
}

// Handle wizard cancellation
const handleWizardCancel = () => {
  router.push('/mcp-server')
}

onMounted(() => {
  // Clear any previous wizard state
  eventBus.emit('mcp-install-wizard-reset')
})
</script>

<template>
  <DashboardLayout :title="t('mcpInstallations.wizard.title')">
    <div class="space-y-6">
      <!-- Header -->
      <div class="mb-6">
        <div class="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="sm"
            @click="goBack"
            class="flex items-center gap-2"
          >
            <ArrowLeft class="h-4 w-4" />
            {{ t('navigation.back') }}
          </Button>
        </div>
      </div>

      <!-- Wizard Component -->
      <McpServerInstallWizard
        :initial-server-id="route.query.serverId as string"
        :initial-step="route.query.step ? parseInt(route.query.step as string) - 1 : 0"
        @complete="handleWizardComplete"
        @cancel="handleWizardCancel"
      />
    </div>
  </DashboardLayout>
</template>
