<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import DashboardLayout from '@/components/DashboardLayout.vue'
import McpServerReadme from '@/components/mcp-server/view/McpServerReadme.vue'
import McpServerInfoSidebar from '@/components/mcp-server/view/McpServerInfoSidebar.vue'
import { McpCatalogService } from '@/services/mcpCatalogService'
import type { McpServer } from '@/views/admin/mcp-server-catalog/types'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { setBreadcrumbs } = useBreadcrumbs()

const server = ref<McpServer | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

const readmeContent = ref<string | null>(null)
const isLoadingReadme = ref(false)

const serverId = route.params.id as string

async function fetchReadme() {
  if (!serverId) return

  try {
    isLoadingReadme.value = true
    readmeContent.value = await McpCatalogService.getServerReadme(serverId)
  } catch (err) {
    console.error('Failed to fetch README:', err)
    readmeContent.value = null
  } finally {
    isLoadingReadme.value = false
  }
}

onMounted(async () => {
  setBreadcrumbs([
    { label: t('mcpInstallations.title'), href: '/mcp-server' },
    { label: t('mcpInstallations.view.titleLoading') }
  ])

  try {
    isLoading.value = true
    server.value = await McpCatalogService.getServerById(serverId)
    error.value = null

    // Update breadcrumbs with server name
    if (server.value) {
      setBreadcrumbs([
        { label: t('mcpInstallations.title'), href: '/mcp-server' },
        { label: server.value.name }
      ])
      await fetchReadme()
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    server.value = null
  } finally {
    isLoading.value = false
  }
})

const installServer = () => {
  router.push({
    path: '/mcp-server/install',
    query: {
      serverId: serverId,
      step: '2'
    }
  })
}
</script>

<template>
  <DashboardLayout>
    <div class="space-y-6">
      <div v-if="isLoading" class="text-muted-foreground text-center py-12">
        {{ t('mcpInstallations.view.loading') }}
      </div>

      <div v-else-if="error" class="text-red-500 text-center py-12">
        {{ t('mcpInstallations.view.errorLoading', { error }) }}
      </div>

      <div v-else-if="server" class="flex flex-col lg:flex-row gap-6">
        <div class="flex-1 min-w-0">
          <McpServerReadme
            :readme-base64="readmeContent"
            :server-name="server.name"
            :is-loading="isLoadingReadme"
          />
        </div>

        <McpServerInfoSidebar
          :server="server"
          @install="installServer"
        />
      </div>
    </div>
  </DashboardLayout>
</template>
