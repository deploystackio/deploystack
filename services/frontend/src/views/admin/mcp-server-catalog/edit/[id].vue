<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */

import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Loader2 } from 'lucide-vue-next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import DashboardLayout from '@/components/DashboardLayout.vue'
import McpServerFormWizard from '@/components/admin/mcp-catalog/McpServerEditFormWizard.vue'
import { McpCatalogService } from '@/services/mcpCatalogService'
import { useEventBus } from '@/composables/useEventBus'
import { toast } from 'vue-sonner'
import type {
  McpServer,
  McpServerFormData,
  UpdateMcpServerRequest
} from '../types'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const eventBus = useEventBus()
const { setBreadcrumbs } = useBreadcrumbs()

// State
const isLoading = ref(true)
const isRetrying = ref(false)
const isSubmitting = ref(false)
const loadError = ref<string | null>(null)
const serverData = ref<McpServer | null>(null)
const initialFormData = ref<Partial<McpServerFormData> | null>(null)

// Get server ID from route
const serverId = route.params.id as string

// Navigation
const goToCatalog = () => {
  router.push('/admin/mcp-server-catalog')
}

// Clear all edit-related storage to ensure fresh data loading
const clearEditStorage = () => {
  // Clear all edit-related storage keys
  const editStorageKeys = [
    'edit_basic_data',
    'edit_repository_data',
    'edit_repository_setup_data',
    'edit_technical_data',
    'edit_configuration_schema',
    'edit_claude_config',
    'edit_readme_data',
    'technical_extracted_env_vars_edit',
    'technical_extracted_headers_edit',
    'technical_remote_url',
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

    // Store the RAW server response in storage for debugging
    eventBus.setState('edit_raw_server_response', server)

    serverData.value = server

    // Update breadcrumbs with server name
    setBreadcrumbs([
      { label: t('mcpCatalog.title'), href: '/admin/mcp-server-catalog' },
      { label: server.name, href: `/admin/mcp-server-catalog/view/${serverId}` },
      { label: t('mcpCatalog.form.navigation.edit') }
    ])

    // Fetch README data separately using dedicated endpoint
    let readmeBase64 = ''
    try {
      const readmeResponse = await McpCatalogService.getServerReadme(serverId)
      readmeBase64 = readmeResponse || ''
    } catch (readmeError) {
      console.warn('Failed to fetch README:', readmeError)
      // Continue even if README fetch fails
    }

    // Convert server data to form data format
    initialFormData.value = convertServerToFormData(server, readmeBase64)

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
const convertServerToFormData = (server: McpServer, readmeBase64: string = ''): Partial<McpServerFormData> => {
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
    template_headers: parseSchemaField(server.template_headers, []),
    template_url_query_params: parseSchemaField(server.template_url_query_params, []),
    team_args_schema: parseSchemaField(server.team_args_schema, []),
    team_env_schema: parseSchemaField(server.team_env_schema, []),
    team_headers_schema: parseSchemaField(server.team_headers_schema, []),
    team_url_query_params_schema: parseSchemaField(server.team_url_query_params_schema, []),
    user_args_schema: parseSchemaField(server.user_args_schema, []),
    user_env_schema: parseSchemaField(server.user_env_schema, []),
    user_headers_schema: parseSchemaField(server.user_headers_schema, []),
    user_url_query_params_schema: parseSchemaField(server.user_url_query_params_schema, [])
  }

  return {
    basic: {
      name: server.name || '',
      slug: server.slug || '',
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
      website_url: server.website_url || '',
      icon_url: server.icon_url || ''
    },
    repository: {
      repository_url: server.repository_url || '',
      repository_source: server.repository_source || 'github',
      repository_id: server.repository_id || '',
      repository_subfolder: server.repository_subfolder || '',
      git_branch: server.git_branch || '',
      website_url: server.website_url || ''
    },
    technical: {
      language: server.language || '',
      runtime: server.runtime || '',
      packages: server.packages,
      remotes: server.remotes,
      dependencies: server.dependencies ? JSON.stringify(server.dependencies, null, 2) : '',
      transport_type: server.transport_type || 'auto'
    },
    configuration_schema: configurationSchema,
    repository_setup: {
      repository_url: server.repository_url || '',
      repository_source: server.repository_source || 'github',
      git_branch: server.git_branch || '',
      auto_populated: false
    },
    readme: {
      github_readme_base64: readmeBase64
    },
    review: {}
  }
}

// Handle form submission
const handleSubmit = async (formData: McpServerFormData) => {
  // Get the original server data for tools/resources/prompts
  const server = serverData.value
  if (!server) {
    toast.error(t('mcpCatalog.edit.errors.noServerData'))
    eventBus.emit('mcp-server-update-error', { serverId, error: 'No server data' })
    return
  }

  try {
    isSubmitting.value = true

    // Parse resources and prompts from server data
    const parsedResources = parseJsonField(server.resources, [])
    const parsedPrompts = parseJsonField(server.prompts, [])

    // Get fresh repository data from storage (RepositoryStep uses storage-first architecture)
    const repositorySetupData = eventBus.getState<{
      repository_url?: string
      repository_source?: string
      git_branch?: string
      auto_populated?: boolean
    }>('edit_repository_setup_data')

    // Merge repository data: storage takes priority over formData
    const finalRepositoryData = {
      repository_url: repositorySetupData?.repository_url !== undefined ? repositorySetupData.repository_url : formData.repository.repository_url,
      repository_source: repositorySetupData?.repository_source !== undefined ? repositorySetupData.repository_source : formData.repository.repository_source,
      git_branch: repositorySetupData?.git_branch !== undefined ? repositorySetupData.git_branch : formData.repository.git_branch
    }

    // Get README markdown from storage and convert to base64 (UTF-8 safe)
    const readmeData = eventBus.getState<{ readme_markdown: string }>('edit_readme_data')
    const readmeMarkdown = readmeData?.readme_markdown || ''
    const readmeBase64 = readmeMarkdown
      ? btoa(new TextEncoder().encode(readmeMarkdown).reduce((data, byte) => data + String.fromCharCode(byte), ''))
      : ''

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

    // Parse dependencies - handle both string and object formats
    let parsedDependencies: any = undefined
    if (formData.technical.dependencies) {
      if (typeof formData.technical.dependencies === 'string') {
        try {
          parsedDependencies = JSON.parse(formData.technical.dependencies)
        } catch {
          parsedDependencies = undefined
        }
      } else {
        parsedDependencies = formData.technical.dependencies
      }
    }

    // Convert form data to API request format
    const requestData: UpdateMcpServerRequest = {
      // Basic info
      name: formData.basic.name,
      slug: formData.basic.slug || undefined,
      description: formData.basic.description,
      long_description: formData.basic.long_description || undefined,
      category_id: formData.basic.category_id || undefined,
      author_name: formData.basic.author_name || undefined,
      author_contact: formData.basic.author_contact || undefined,
      organization: formData.basic.organization || undefined,
      license: formData.basic.license || undefined,
      tags: formData.basic.tags,
      featured: formData.basic.featured,
      auto_install_new_default_team: formData.basic.auto_install_new_default_team,
      icon_url: formData.basic.icon_url || undefined,

      // Repository (use finalRepositoryData which merges storage + formData)
      repository_url: finalRepositoryData.repository_url || undefined,
      repository_source: finalRepositoryData.repository_source || undefined,
      repository_id: formData.repository.repository_id || undefined,
      repository_subfolder: formData.repository.repository_subfolder || undefined,
      git_branch: finalRepositoryData.git_branch ? finalRepositoryData.git_branch : null,
      website_url: formData.basic.website_url || undefined,

      // README content
      github_readme_base64: readmeBase64 || undefined,

      // Technical
      language: formData.technical.language,
      runtime: formData.technical.runtime,
      packages: formData.technical.packages,
      remotes: formData.technical.remotes,
      dependencies: parsedDependencies,

      // UPDATED: Use the synchronized configuration schema
      template_args: finalConfigurationSchema.template_args,
      template_env: finalConfigurationSchema.template_env,
      template_headers: finalConfigurationSchema.template_headers,
      template_url_query_params: finalConfigurationSchema.template_url_query_params,
      team_args_schema: finalConfigurationSchema.team_args_schema,
      team_env_schema: finalConfigurationSchema.team_env_schema,
      team_headers_schema: finalConfigurationSchema.team_headers_schema,
      team_url_query_params_schema: finalConfigurationSchema.team_url_query_params_schema,
      user_args_schema: finalConfigurationSchema.user_args_schema,
      user_env_schema: finalConfigurationSchema.user_env_schema,
      user_headers_schema: finalConfigurationSchema.user_headers_schema,
      user_url_query_params_schema: finalConfigurationSchema.user_url_query_params_schema,

      // Resources and prompts (from server data)
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update server'
    toast.error(errorMessage)
    eventBus.emit('mcp-server-update-error', { serverId, error: errorMessage })
  } finally {
    isSubmitting.value = false
  }
}

const handleCancel = () => {
  router.push(`/admin/mcp-server-catalog/view/${serverId}`)
}

// Load data on mount
onMounted(() => {
  setBreadcrumbs([
    { label: t('mcpCatalog.title'), href: '/admin/mcp-server-catalog' },
    { label: t('mcpCatalog.edit.titleLoading') }
  ])
  loadServerData()
})
</script>

<template>
  <DashboardLayout>
    <div class="space-y-6">
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
            :disabled="isRetrying"
            @click="loadServerData"
          >
            <Spinner v-if="isRetrying" class="mr-2" />
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
        :is-submitting="isSubmitting"
        :submit-button-text="t('mcpCatalog.form.navigation.update')"
        @submit="handleSubmit"
        @cancel="handleCancel"
      />
    </div>
  </DashboardLayout>
</template>
