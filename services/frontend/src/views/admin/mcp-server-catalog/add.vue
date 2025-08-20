<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-vue-next'
import DashboardLayout from '@/components/DashboardLayout.vue'
import McpServerAddFormWizard from '@/components/admin/mcp-catalog/McpServerAddFormWizard.vue'
import { McpCatalogService } from '@/services/mcpCatalogService'
import type { CreateMcpServerRequest } from './types'

// Form data interface for add wizard
interface McpServerAddFormData {
  github: {
    github_url: string
    git_branch: string
    auto_populated: boolean
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repo_data?: any
  }
  claudeConfig: {
    claude_desktop_config: object
    raw_json: string
  }
  basic: {
    name: string
    description: string
    long_description: string
    category_id: string
    author_name: string
    author_contact: string
    organization: string
    license: string
    tags: string[]
    featured: boolean
    auto_install_new_default_team: boolean
    transport_type: string
  }
}

const { t } = useI18n()
const router = useRouter()

const goBack = () => {
  router.push('/admin/mcp-server-catalog')
}

const handleSubmit = async (formData: McpServerAddFormData) => {
  try {
    // Extract technical details from Claude Desktop config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const claudeConfig = formData.claudeConfig.claude_desktop_config as any
    const serverKeys = Object.keys(claudeConfig.mcpServers || {})
    const serverKey = serverKeys[0]

    if (!serverKey) {
      throw new Error('No server configuration found in Claude Desktop config')
    }

    const serverConfig = claudeConfig.mcpServers[serverKey] || {}

    // Create installation methods from Claude config
    const installationMethods = [{
      client: 'claude-desktop' as const,
      command: serverConfig.command || 'npx',
      args: serverConfig.args || [],
      env: serverConfig.env || {}
    }]

    // Create environment variables from Claude config
    const environmentVariables = Object.keys(serverConfig.env || {}).map(key => ({
      name: key,
      description: `Environment variable: ${key}`,
      required: true
    }))

    // Create args template from Claude config
    const argsTemplate = (serverConfig.args || []).map((arg: string, index: number) => {
      // Extract meaningful name from flag-style args (--debug, --port, etc.)
      const isFlag = arg.startsWith('-')
      const argName = isFlag ? arg.replace(/^-+/, '').split('=')[0] : `arg_${index + 1}`
      
      return {
        name: argName,
        description: `Command line argument: ${arg}`,
        default_value: arg,
        required: true
      }
    })

    // Convert form data to current API request format (until backend is updated)
    const requestData: CreateMcpServerRequest = {
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

      // GitHub repository info
      github_url: formData.github.github_url,
      git_branch: formData.github.git_branch || 'main',

      // Technical details (required by current backend)
      language: 'JavaScript', // Default, will be updated by GitHub sync
      runtime: 'node', // Default, will be updated by GitHub sync
      runtime_min_version: '18.0.0',
      installation_methods: installationMethods,
      environment_variables: environmentVariables,
      args: argsTemplate,

      tools: [],

      // Optional fields
      resources: [],
      prompts: [],
      dependencies: {},

      // Claude Desktop configuration (for future backend use)
      claude_desktop_config: formData.claudeConfig.claude_desktop_config,

      // Transport type (only send if not auto-extraction)
      transport_type: formData.basic.transport_type !== 'auto' ? formData.basic.transport_type as 'stdio' | 'http' | 'sse' : undefined,

      // Server settings
      visibility: 'global',
      featured: formData.basic.featured,
      auto_install_new_default_team: formData.basic.auto_install_new_default_team
    }

    // Submit to API
    await McpCatalogService.createGlobalServer(requestData)

    // Show success toast
    toast.success(t('mcpCatalog.messages.createSuccess'), {
      description: `${formData.basic.name} has been added to the catalog`
    })

    // Navigate back to catalog without query parameters
    await router.push('/admin/mcp-server-catalog')

  } catch (error) {
    // Show error toast
    const errorMessage = error instanceof Error ? error.message : 'Failed to create MCP server'
    toast.error(t('mcpCatalog.messages.createError'), {
      description: errorMessage
    })

    // Re-throw error to let the wizard handle it and reset loading state
    throw error
  }
}

const handleCancel = () => {
  router.push('/admin/mcp-server-catalog')
}
</script>

<template>
  <DashboardLayout :title="t('mcpCatalog.form.title')">
    <div class="space-y-6">
      <!-- Header with back button -->
      <div class="flex items-center gap-4">
        <Button variant="ghost" size="sm" @click="goBack" class="flex items-center gap-2">
          <ArrowLeft class="h-4 w-4" />
          {{ t('mcpCatalog.edit.backToCatalog') }}
        </Button>
      </div>

      <!-- Form Wizard Component -->
      <McpServerAddFormWizard
        @submit="handleSubmit"
        @cancel="handleCancel"
      />
    </div>
  </DashboardLayout>
</template>
