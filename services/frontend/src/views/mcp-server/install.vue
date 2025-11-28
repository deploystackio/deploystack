<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { useEventBus } from '@/composables/useEventBus'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import DashboardLayout from '@/components/DashboardLayout.vue'
import McpServerInstallWizard from '@/components/mcp-server/wizard/McpServerInstallWizard.vue'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const eventBus = useEventBus()
const { setBreadcrumbs } = useBreadcrumbs()


// Handle wizard completion
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleWizardComplete = (installationData: any) => {
  // Emit events for other components to update
  eventBus.emit('mcp-installations-updated')
  
  // Show success toast
  toast.success(t('mcpInstallations.wizard.success.installed', { name: installationData.installation_name }), {
    description: t('mcpInstallations.notifications.installSuccess')
  })

  // Navigate back to main page
  router.push('/mcp-server')
}

// Handle wizard cancellation
const handleWizardCancel = () => {
  router.push('/mcp-server')
}

onMounted(() => {
  setBreadcrumbs([
    { label: t('mcpInstallations.title'), href: '/mcp-server' },
    { label: t('mcpInstallations.wizard.title') }
  ])
  // Clear any previous wizard state
  eventBus.emit('mcp-install-wizard-reset')
})
</script>

<template>
  <DashboardLayout>
    <div class="space-y-6">
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
