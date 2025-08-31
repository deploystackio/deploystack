<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */

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

// Clear all edit-related storage to ensure fresh data loading
const clearEditStorage = () => {
  // Clear all edit-related storage keys
  const editStorageKeys = [
    'edit_basic_data',
    'edit_repository_data',
    'edit_technical_data',
    'edit_configuration_schema',
    'edit_claude_config',
    'technical_extracted_env_vars_edit',
    'mcp_edit_drafts'
  ]

  editStorageKeys.forEach(key => {
    eventBus.clearState(key)
  })

  // Also clear localStorage directly to ensure complete cleanup
  editStorageKeys.forEach(key => {
    localStorage.removeItem(key)
  })
}

// Load server data
const loadServerData = async () => {
  try {
    isLoading.value = true
    isRetrying.value = true
    loadError.value = null

    clearEditStorage()

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

// Convert server data to form data format
const convertServerToFormData = (server: McpServer): Partial<McpServerFormData> => {
  // Convert installation methods to new format

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

  }).filter((method: any) =>
    // Filter out git clone template entries and any invalid entries
    method.command &&
    method.command !== 'git clone <repository_url>' &&
    !method.command.includes('<repository_url>')
  )

  // Parse tags with proper handling
  const parsedTags = parseJsonField(server.tags, [])

  // Convert three-tier schema fields from API response
  const parseSchemaField = (field: any, defaultValue: any) => {
    if (!field) return defaultValue
    if (Array.isArray(field)) return field
    if (typeof field === 'string') {
      try {
        return JSON.parse(field)
      } catch {
        return defaultValue
      }
    }
    return defaultValue
  }

  const configurationSchema = {
    template_args: parseSchemaField(server.template_args, []),
    template_env: parseSchemaField(server.template_env, []),
    team_args_schema: parseSchemaField(server.team_args_schema, []),
    team_env_schema: parseSchemaField(server.team_env_schema, []),
    user_args_schema: parseSchemaField(server.user_args_schema, []),
    user_env_schema: parseSchemaField(server.user_env_schema, [])
  }

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
      featured: Boolean(server.featured),
      auto_install_new_default_team: Boolean(server.auto_install_new_default_team),
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
      dependencies: server.dependencies ? JSON.stringify(server.dependencies, null, 2) : '',
      transport_type: server.transport_type || 'auto'
    },
    configuration_schema: configurationSchema,
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
  // Get the original server data for tools/resources/prompts
  const server = serverData.value
  if (!server) return

  // Parse tools, resources, and prompts from server data
  const parsedTools = parseJsonField(server.tools, [])
  const parsedResources = parseJsonField(server.resources, [])
  const parsedPrompts = parseJsonField(server.prompts, [])

  // CRITICAL FIX: Synchronize environment variables from installation_methods to team_env_schema
  let finalConfigurationSchema = { ...formData.configuration_schema }

  // Extract environment variables from installation_methods
  if (formData.technical.installation_methods && formData.technical.installation_methods.length > 0) {
    const firstMethod = formData.technical.installation_methods[0]
    if (firstMethod && firstMethod.env) {
      const envVarsFromInstallation = Object.keys(firstMethod.env)

      // Get existing team_env_schema and user_env_schema or initialize empty arrays
      const existingTeamEnvSchema = finalConfigurationSchema.team_env_schema || []
      const existingUserEnvSchema = finalConfigurationSchema.user_env_schema || []

      // Get ALL existing environment variable names from both team and user schemas
      const existingTeamEnvNames = existingTeamEnvSchema.map(item => item.name)
      const existingUserEnvNames = existingUserEnvSchema.map(item => item.name)
      const allExistingEnvNames = [...existingTeamEnvNames, ...existingUserEnvNames]

      // Add missing environment variables to team_env_schema (only if not in team OR user schema)
      const newEnvSchemaItems: any[] = []
      envVarsFromInstallation.forEach(envVarName => {
        if (!allExistingEnvNames.includes(envVarName)) {
          newEnvSchemaItems.push({
            name: envVarName,
            type: 'string',
            description: 'Automatically detected from Claude Desktop configuration',
            required: false,
            locked: false,
            default_team_locked: false,
            visible_to_users: true
          })
        } else {
        }
      })

      // Update the final configuration schema
      if (newEnvSchemaItems.length > 0) {
        finalConfigurationSchema = {
          ...finalConfigurationSchema,
          team_env_schema: [...existingTeamEnvSchema, ...newEnvSchemaItems]
        }
      }
    }
  }

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
    auto_install_new_default_team: formData.basic.auto_install_new_default_team,

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

    // UPDATED: Use the synchronized configuration schema
    template_args: finalConfigurationSchema.template_args,
    template_env: finalConfigurationSchema.template_env,
    team_args_schema: finalConfigurationSchema.team_args_schema,
    team_env_schema: finalConfigurationSchema.team_env_schema,
    user_args_schema: finalConfigurationSchema.user_args_schema,
    user_env_schema: finalConfigurationSchema.user_env_schema,

    // Tools, resources, and prompts (from server data)
    tools: parsedTools,
    resources: parsedResources.length > 0 ? parsedResources : undefined,
    prompts: parsedPrompts.length > 0 ? parsedPrompts : undefined,
    transport_type: formData.technical.transport_type !== 'auto' ? formData.technical.transport_type as 'stdio' | 'http' | 'sse' : undefined
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
