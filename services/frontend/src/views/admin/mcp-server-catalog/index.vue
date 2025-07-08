<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-vue-next'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { McpCatalogService } from '@/services/mcpCatalogService'
import { useEventBus } from '@/composables/useEventBus'
import McpServerTableColumns from './McpServerTableColumns.vue'
import type { McpServer, McpServerFilters } from './types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle } from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()
const eventBus = useEventBus()

// State
const servers = ref<McpServer[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')
const successMessage = ref<string | null>(null)

// Filters
const filters = ref<McpServerFilters>({
  visibility: 'global' // Only show global servers in admin catalog
})

// Filter servers based on search query
const filteredServers = computed(() => {
  if (!searchQuery.value) {
    return servers.value
  }
  const query = searchQuery.value.toLowerCase()
  return servers.value.filter(server =>
    server.name.toLowerCase().includes(query) ||
    server.description.toLowerCase().includes(query) ||
    (server.tags && server.tags.some(tag => tag.toLowerCase().includes(query))) ||
    (server.author_name && server.author_name.toLowerCase().includes(query)) ||
    server.language.toLowerCase().includes(query) ||
    server.runtime.toLowerCase().includes(query)
  )
})

// Navigation handlers
const handleAddServer = () => {
  router.push('/admin/mcp-server-catalog/add')
}

const handleEditServer = (serverId: string) => {
  // TODO: Implement edit functionality
  console.log('Edit server:', serverId)
}

const handleDeleteServer = async (serverId: string) => {
  try {
    await McpCatalogService.deleteGlobalServer(serverId)

    // Remove from local state
    servers.value = servers.value.filter(s => s.id !== serverId)

    // Show success message
    successMessage.value = t('mcpCatalog.messages.deleteSuccess')
    setTimeout(() => {
      successMessage.value = null
    }, 5000)

    // Emit global event
    eventBus.emit('mcp-catalog-updated')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to delete server'
  }
}

const handleToggleFeatured = async (serverId: string, featured: boolean) => {
  try {
    const updatedServer = await McpCatalogService.toggleFeatured(serverId, featured)

    // Update local state
    const index = servers.value.findIndex(s => s.id === serverId)
    if (index !== -1) {
      servers.value[index] = updatedServer
    }

    // Show success message
    successMessage.value = featured
      ? t('mcpCatalog.messages.featureSuccess')
      : t('mcpCatalog.messages.unfeatureSuccess')
    setTimeout(() => {
      successMessage.value = null
    }, 3000)

    // Emit global event
    eventBus.emit('mcp-catalog-updated')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to update server'
  }
}

const handleViewServer = (serverId: string) => {
  // TODO: Implement view server details
  console.log('View server:', serverId)
}

// Fetch servers from API
const fetchServers = async (forceRefresh = false): Promise<void> => {
  try {
    isLoading.value = true
    error.value = null

    servers.value = await McpCatalogService.getGlobalServers(filters.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    servers.value = []
  } finally {
    isLoading.value = false
  }
}

// Handle server creation success from add page
const handleServerCreated = () => {
  fetchServers(true)
  successMessage.value = t('mcpCatalog.messages.createSuccess')
  setTimeout(() => {
    successMessage.value = null
  }, 5000)
}

// Load data on component mount
onMounted(async () => {
  await fetchServers()

  // Listen for catalog updates from other components
  eventBus.on('mcp-catalog-updated', () => {
    fetchServers(true)
  })

  // Listen for server creation from add page
  eventBus.on('mcp-server-created', handleServerCreated)
})

onUnmounted(() => {
  // Clean up event listeners
  eventBus.off('mcp-catalog-updated')
  eventBus.off('mcp-server-created', handleServerCreated)
})
</script>

<template>
  <DashboardLayout :title="t('mcpCatalog.title')">
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <p class="text-muted-foreground">{{ t('mcpCatalog.description') }}</p>
        </div>
        <Button
          @click="handleAddServer"
          class="flex items-center gap-2"
        >
          <Plus class="h-4 w-4" />
          {{ t('mcpCatalog.addButton') }}
        </Button>
      </div>

      <!-- Success Message -->
      <Alert v-if="successMessage" class="border-green-200 bg-green-50 text-green-800">
        <CheckCircle class="h-4 w-4" />
        <AlertDescription>{{ successMessage }}</AlertDescription>
      </Alert>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-muted-foreground">
        {{ t('mcpCatalog.table.loading') }}
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-red-500">
        {{ t('mcpCatalog.table.error', { error }) }}
      </div>

      <!-- Data Table -->
      <div v-else class="space-y-4">
        <!-- Search Input -->
        <div class="flex items-center py-4">
          <Input
            :placeholder="t('mcpCatalog.table.search.placeholder')"
            v-model="searchQuery"
            class="max-w-sm"
          />
        </div>

        <!-- Servers Table Component -->
        <McpServerTableColumns
          :servers="filteredServers"
          :on-edit-server="handleEditServer"
          :on-delete-server="handleDeleteServer"
          :on-toggle-featured="handleToggleFeatured"
          :on-view-server="handleViewServer"
        />
      </div>
    </div>
  </DashboardLayout>
</template>
