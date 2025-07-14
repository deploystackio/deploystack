<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
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
    const serverConfig = claudeConfig.mcpServers?.[serverKey] || {}

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

      // Default tools (required by current backend)
      tools: [{
        name: 'mcp_tool',
        description: 'MCP server tool'
      }],

      // Optional fields
      resources: [],
      prompts: [],
      dependencies: {},

      // Claude Desktop configuration (for future backend use)
      claude_desktop_config: formData.claudeConfig.claude_desktop_config,

      // Server settings
      visibility: 'global',
      featured: false
    }

    // Submit to API
    await McpCatalogService.createGlobalServer(requestData)

    // Navigate back to catalog with success parameter
    await router.push({
      path: '/admin/mcp-server-catalog',
      query: { created: 'true', serverName: formData.basic.name }
    })

  } catch (error) {
    // Re-throw error to let the wizard handle it
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
