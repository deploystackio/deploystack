<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-vue-next'
import NavbarLayout from '@/components/NavbarLayout.vue'
import McpServerAddFormWizard from '@/components/admin/mcp-catalog/McpServerAddFormWizard.vue'
import { McpCatalogService } from '@/services/mcpCatalogService'
import type { CreateMcpServerRequest } from './types'

// This interface is now defined in the wizard and the payload is constructed there.
// We just need to type the incoming payload for the handleSubmit function.
type FinalPayload = CreateMcpServerRequest;

const { t } = useI18n()
const router = useRouter()
const { setBreadcrumbs } = useBreadcrumbs()

onMounted(() => {
  setBreadcrumbs([
    { label: t('mcpCatalog.title'), href: '/admin/mcp-server-catalog' },
    { label: t('mcpCatalog.form.title') }
  ])
})

const goBack = () => {
  router.push('/admin/mcp-server-catalog')
}

const handleSubmit = async (formData: FinalPayload) => {
  try {
    // The formData is now the final payload, constructed in the wizard.
    // We can send it directly to the service.
    await McpCatalogService.createGlobalServer(formData)

    // Show success toast
    toast.success(t('mcpCatalog.messages.createSuccess'), {
      description: `${formData.name} has been added to the catalog`
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
  <NavbarLayout>
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
  </NavbarLayout>
</template>
