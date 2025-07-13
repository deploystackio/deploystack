<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-vue-next'
import DashboardLayout from '@/components/DashboardLayout.vue'
import McpServerFormWizard from '@/components/admin/mcp-catalog/McpServerFormWizard.vue'
import { McpCatalogService } from '@/services/mcpCatalogService'
import { useEventBus } from '@/composables/useEventBus'
import type {
  McpServerFormData,
  CreateMcpServerRequest
} from './types'

const { t } = useI18n()
const router = useRouter()
const eventBus = useEventBus()

const goBack = () => {
  router.push('/admin/mcp-server-catalog')
}

const handleSubmit = async (formData: McpServerFormData) => {
  try {
    // Convert form data to API request format
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
      default_config: formData.capabilities.default_config ? JSON.parse(formData.capabilities.default_config) : undefined,

      // Server settings
      visibility: 'global',
      featured: false
    }

    // Submit to API
    await McpCatalogService.createGlobalServer(requestData)

    // Emit success event
    eventBus.emit('mcp-server-created')

    // Navigate back to catalog
    router.push('/admin/mcp-server-catalog')

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
          Back to Catalog
        </Button>
      </div>

      <!-- Form Wizard Component -->
      <McpServerFormWizard
        mode="create"
        @submit="handleSubmit"
        @cancel="handleCancel"
      />
    </div>
  </DashboardLayout>
</template>
