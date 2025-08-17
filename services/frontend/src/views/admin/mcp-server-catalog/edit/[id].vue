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
const isRetrying = ref(false)
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
    isRetrying.value = true
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
    isRetrying.value = false
  }
}

// Helper function to parse JSON fields with proper error handling
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseJsonField = (fieldValue: any, defaultValue: any) => {
  if (!fieldValue || fieldValue === '' || (typeof fieldValue === 'string' && fieldValue.trim() === '')) {
    return defaultValue
  }
  if (typeof fieldValue !== 'string') {
    return fieldValue // Already parsed or not a string
  }
  try {
    return JSON.parse(fieldValue)
  } catch (e) {
    console.warn('Failed to parse JSON field:', fieldValue, e)
    return defaultValue
  }
}

// Helper function to parse environment variables with robust handling
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseEnvironmentVariables = (envVars: any): any[] => {
  // Handle null/undefined (service returns null as fallback)
  if (!envVars || envVars === null || envVars === undefined) return []

  // Handle arrays (expected format from API)
  if (Array.isArray(envVars)) {
    return envVars
  }

  // Handle JSON strings (legacy format)
  if (typeof envVars === 'string') {
    try {
      const parsed = JSON.parse(envVars)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  // Handle objects (in case service parsing changes)
  if (typeof envVars === 'object') {
    // If it's an object with array-like properties, try to convert
    if (Object.keys(envVars).every(key => !isNaN(Number(key)))) {
      return Object.values(envVars)
    }
  }

  return []
}

// Convert server data to form data format
const convertServerToFormData = (server: McpServer): Partial<McpServerFormData> => {
  // Convert installation methods to new format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const convertedInstallationMethods = (server.installation_methods || []).map((method: any) => {
    // Handle old format: {type, command, description}
    if (method.type && method.command && !method.client) {
      // Parse old format command like "npx @brightdata/mcp" into command and args
      const commandParts = method.command.split(' ')
      const command = commandParts[0] || 'npx'
      const args = commandParts.slice(1)

      return {
        client: 'claude-desktop' as const,
        command: command,
        args: args,
        env: {} // Old format doesn't have env, so empty object
      }
    }

    // Handle new format: {client, command, args, env}
    return {
      client: 'claude-desktop' as const,
      command: method.command || 'npx',
      args: method.args || [],
      env: method.env || {}
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }).filter((method: any) =>
    // Filter out git clone template entries and any invalid entries
    method.command &&
    method.command !== 'git clone <repository_url>' &&
    !method.command.includes('<repository_url>')
  )

  // Parse tags with proper handling
  const parsedTags = parseJsonField(server.tags, [])

  // Parse tools, resources, and prompts with proper handling
  const parsedTools = parseJsonField(server.tools, [])
  const parsedResources = parseJsonField(server.resources, [])
  const parsedPrompts = parseJsonField(server.prompts, [])

  const parsedEnvironmentVariables = parseEnvironmentVariables(server.environment_variables)

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
      tags: parsedTags,
      featured: Boolean(server.featured)
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
      tools: parsedTools,
      resources: parsedResources,
      prompts: parsedPrompts,
      environment_variables: parsedEnvironmentVariables,
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
    featured: formData.basic.featured,

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

  // Navigate back to view page with success parameter
  router.push({
    path: `/admin/mcp-server-catalog/view/${serverId}`,
    query: { updated: 'true' }
  })
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
          <Button
            variant="outline"
            size="sm"
            :loading="isRetrying"
            :loading-text="t('mcpCatalog.edit.errorActions.loading')"
            @click="loadServerData"
          >
            {{ t('mcpCatalog.edit.errorActions.tryAgain') }}
          </Button>
          <Button variant="ghost" size="sm" @click="goToCatalog">
            {{ t('mcpCatalog.edit.errorActions.backToCatalog') }}
          </Button>
        </div>
      </Alert>

      <!-- Form Wizard Component -->
      <McpServerFormWizard
        v-if="initialFormData"
        mode="edit"
        :initial-data="initialFormData"
        :server-id="serverId"
        :submit-button-text="t('mcpCatalog.form.navigation.update')"
        @submit="handleSubmit"
        @cancel="handleCancel"
      />
    </div>
  </DashboardLayout>
</template>
