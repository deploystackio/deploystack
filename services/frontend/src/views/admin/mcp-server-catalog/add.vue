<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { toast } from 'vue-sonner'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { DsPageHeading } from '@/components/ui/ds-page-heading'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
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
    <DsPageHeading :title="t('mcpCatalog.form.title')">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink as-child>
              <RouterLink to="/admin/mcp-server-catalog">
                {{ t('mcpCatalog.title') }}
              </RouterLink>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{{ t('mcpCatalog.form.title') }}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </DsPageHeading>

    <div class="mt-6">
      <!-- Form Wizard Component -->
      <McpServerAddFormWizard
        @submit="handleSubmit"
        @cancel="handleCancel"
      />
    </div>
  </NavbarLayout>
</template>
