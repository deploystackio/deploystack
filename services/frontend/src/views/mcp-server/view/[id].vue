<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-vue-next'
import DashboardLayout from '@/components/DashboardLayout.vue'
import McpServerReadme from '@/components/mcp-server/view/McpServerReadme.vue'
import McpServerInfoSidebar from '@/components/mcp-server/view/McpServerInfoSidebar.vue'
import { McpCatalogService } from '@/services/mcpCatalogService'
import type { McpServer } from '@/views/admin/mcp-server-catalog/types'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const server = ref<McpServer | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

const serverId = route.params.id as string

onMounted(async () => {
  try {
    isLoading.value = true
    server.value = await McpCatalogService.getServerById(serverId)
    error.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    server.value = null
  } finally {
    isLoading.value = false
  }
})

const goBack = () => {
  router.push('/mcp-server')
}

const installServer = () => {
  router.push({
    path: '/mcp-server/add',
    query: {
      serverId: serverId,
      step: '2'
    }
  })
}
</script>

<template>
  <DashboardLayout :title="server ? server.name : t('mcpInstallations.view.titleLoading')">
    <div class="space-y-6">
      <div class="flex items-center">
        <Button
          variant="outline"
          @click="goBack"
        >
          <ArrowLeft class="h-4 w-4 mr-2" />
          {{ t('mcpInstallations.view.backToServers') }}
        </Button>
      </div>

      <div v-if="isLoading" class="text-muted-foreground text-center py-12">
        {{ t('mcpInstallations.view.loading') }}
      </div>

      <div v-else-if="error" class="text-red-500 text-center py-12">
        {{ t('mcpInstallations.view.errorLoading', { error }) }}
      </div>

      <div v-else-if="server" class="flex flex-col lg:flex-row gap-6">
        <div class="flex-1 min-w-0">
          <McpServerReadme
            :readme-base64="server.github_readme_base64"
            :server-name="server.name"
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
