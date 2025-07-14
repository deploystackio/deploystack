<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-vue-next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import DashboardLayout from '@/components/DashboardLayout.vue'
import McpServerFormWizard from '@/components/admin/mcp-catalog/McpServerEditFormWizard.vue'
import { McpCatalogService } from '@/services/mcpCatalogService'
import { useEventBus } from '@/composables/useEventBus'
import type {
  McpServer,
  McpServerFormData,
  UpdateMcpServerRequest
} from '../types'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const eventBus = useEventBus()

// State
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const serverData = ref<McpServer | null>(null)
const initialFormData = ref<Partial<McpServerFormData> | null>(null)

// Get server ID from route
const serverId = route.params.id as string

// Navigation
const goBack = () => {
  router.push(`/admin/mcp-server-catalog/view/${serverId}`)
}

const goToCatalog = () => {
  router.push('/admin/mcp-server-catalog')
}

// Load server data
const loadServerData = async () => {
  try {
    isLoading.value = true
    loadError.value = null

    const server = await McpCatalogService.getServerById(serverId)
    serverData.value = server

    // Convert server data to form data format
    initialFormData.value = convertServerToFormData(server)

  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Failed to load server data'
    console.error('Failed to load server:', error)
  } finally {
    isLoading.value = false
  }
}

// Convert server data to form data format
const convertServerToFormData = (server: McpServer): Partial<McpServerFormData> => {
  // Convert installation methods to new format
  const convertedInstallationMethods = (server.installation_methods || []).map(method => {
    return {
      client: 'claude-desktop' as const,
      command: method.command || 'npx',
      args: method.args || [],
      env: method.env || {}
    }
  })

  return {
    basic: {
      name: server.name || '',
      description: server.description || '',
      long_description: server.long_description || '',
      category_id: server.category_id || '',
      author_name: server.author_name || '',
      author_contact: server.author_contact || '',
      organization: server.organization || '',
      license: server.license || '',
      tags: server.tags || []
    },
    repository: {
      github_url: server.github_url || '',
      git_branch: server.git_branch || 'main',
      homepage_url: server.homepage_url || ''
    },
    technical: {
      language: server.language || '',
      runtime: server.runtime || '',
      runtime_min_version: server.runtime_min_version || '',
      installation_methods: convertedInstallationMethods,
      dependencies: server.dependencies ? JSON.stringify(server.dependencies, null, 2) : ''
    },
    capabilities: {
      tools: server.tools || [],
      resources: server.resources || [],
      prompts: server.prompts || [],
      environment_variables: server.environment_variables || [],
      default_config: server.default_config ? JSON.stringify(server.default_config, null, 2) : ''
    },
    github: {
      github_url: server.github_url || '',
      git_branch: server.git_branch || 'main',
      auto_populated: false
    },
    review: {}
  }
}

// Handle form submission
const handleSubmit = async (formData: McpServerFormData) => {
  try {
    // Convert form data to API request format
    const requestData: UpdateMcpServerRequest = {
      // Basic info
      name: formData.basic.name,
      description: formData.basic.description,
      long_description: formData.basic.long_description || undefined,
      category_id: formData.basic.category_id || undefined,
      author_name: formData.basic.author_name || undefined,
      author_contact: formData.basic.author_contact || undefined,
      organization: formData.basic.organization || undefined,
      license: formData.basic.license || undefined,
      tags: formData.basic.tags.length > 0 ? formData.basic.tags : undefined,

      // Repository (use GitHub data if available, fallback to repository data)
      github_url: formData.github.github_url || formData.repository.github_url || undefined,
      git_branch: formData.github.git_branch || formData.repository.git_branch || 'main',
      homepage_url: formData.repository.homepage_url || undefined,

      // Technical
      language: formData.technical.language,
      runtime: formData.technical.runtime,
      runtime_min_version: formData.technical.runtime_min_version || undefined,
      installation_methods: formData.technical.installation_methods,
      dependencies: formData.technical.dependencies ? JSON.parse(formData.technical.dependencies) : undefined,

      // Capabilities
      tools: formData.capabilities.tools,
      resources: formData.capabilities.resources.length > 0 ? formData.capabilities.resources : undefined,
      prompts: formData.capabilities.prompts.length > 0 ? formData.capabilities.prompts : undefined,
      environment_variables: formData.capabilities.environment_variables.length > 0 ? formData.capabilities.environment_variables : undefined,
      default_config: formData.capabilities.default_config ? JSON.parse(formData.capabilities.default_config) : undefined
    }

    // Submit to API
    await McpCatalogService.updateGlobalServer(serverId, requestData)

    // Emit success event
    eventBus.emit('mcp-server-updated', { serverId })

    // Navigate back to view page
    router.push(`/admin/mcp-server-catalog/view/${serverId}`)

  } catch (error) {
    // Re-throw error to let the wizard handle it
    throw error
  }
}

const handleCancel = () => {
  router.push(`/admin/mcp-server-catalog/view/${serverId}`)
}

// Load data on mount
onMounted(() => {
  loadServerData()
})
</script>

<template>
  <DashboardLayout :title="isLoading ? t('mcpCatalog.edit.titleLoading') : t('mcpCatalog.edit.title', { name: serverData?.name || '' })">
    <div class="space-y-6">
      <!-- Header with back button -->
      <div class="flex items-center gap-4">
        <Button variant="ghost" size="sm" @click="goBack" class="flex items-center gap-2">
          <ArrowLeft class="h-4 w-4" />
          {{ t('mcpCatalog.edit.backToCatalog') }}
        </Button>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <div class="flex items-center gap-2 text-muted-foreground">
          <Loader2 class="h-5 w-5 animate-spin" />
          <span>{{ t('mcpCatalog.edit.loading') }}</span>
        </div>
      </div>

      <!-- Error State -->
      <Alert v-else-if="loadError" variant="destructive">
        <AlertDescription>
          {{ t('mcpCatalog.edit.errorLoading', { error: loadError }) }}
        </AlertDescription>
        <div class="mt-4 flex gap-2">
          <Button variant="outline" size="sm" @click="loadServerData">
            Try Again
          </Button>
          <Button variant="ghost" size="sm" @click="goToCatalog">
            Back to Catalog
          </Button>
        </div>
      </Alert>

      <!-- Form Wizard Component -->
      <McpServerFormWizard
        v-else-if="initialFormData"
        mode="edit"
        :initial-data="initialFormData"
        :submit-button-text="t('mcpCatalog.form.navigation.update')"
        @submit="handleSubmit"
        @cancel="handleCancel"
      />
    </div>
  </DashboardLayout>
</template>
