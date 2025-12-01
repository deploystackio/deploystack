<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { useEventBus } from '@/composables/useEventBus'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { McpCatalogService } from '@/services/mcpCatalogService'
import DashboardLayout from '@/components/DashboardLayout.vue'
import McpServerInstallWizard from '@/components/mcp-server/wizard/McpServerInstallWizard.vue'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const eventBus = useEventBus()
const { setBreadcrumbs } = useBreadcrumbs()

// State
const isLoading = ref(true)
const error = ref<string | null>(null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const serverData = ref<any>(null)

// Get server ID from route params
const serverId = route.params.id as string

// Fetch server data
const fetchServerData = async () => {
  try {
    isLoading.value = true
    error.value = null

    const data = await McpCatalogService.getServerById(serverId)

    if (!data) {
      error.value = 'Server not found'
      return
    }

    serverData.value = data
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load server'
  } finally {
    isLoading.value = false
  }
}

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

  fetchServerData()
})
</script>

<template>
  <DashboardLayout>
    <div class="space-y-6">
      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center py-24">
        <Spinner class="h-8 w-8" />
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex flex-col items-center justify-center py-24 space-y-4">
        <AlertTriangle class="h-12 w-12 text-red-500" />
        <p class="text-lg text-gray-700">{{ error }}</p>
        <div class="flex gap-3">
          <Button variant="outline" @click="router.push('/mcp-server/search')">
            Search Servers
          </Button>
          <Button @click="fetchServerData">
            Retry
          </Button>
        </div>
      </div>

      <!-- Wizard Component -->
      <McpServerInstallWizard
        v-else
        :server-id="serverId"
        :server-data="serverData"
        @complete="handleWizardComplete"
        @cancel="handleWizardCancel"
      />
    </div>
  </DashboardLayout>
</template>
