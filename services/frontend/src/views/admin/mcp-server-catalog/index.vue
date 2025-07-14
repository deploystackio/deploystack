<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-vue-next'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { McpCatalogService, type PaginationMeta } from '@/services/mcpCatalogService'
import { useEventBus } from '@/composables/useEventBus'
import McpServerTableColumns from './McpServerTableColumns.vue'
import PaginationControls from '@/components/ui/pagination/PaginationControls.vue'
import type { McpServer, McpServerFilters } from './types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle } from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const eventBus = useEventBus()

// State
const servers = ref<McpServer[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')
const successMessage = ref<string | null>(null)

// Pagination state
const currentPage = ref(1)
const pageSize = ref(20)
const totalItems = ref(0)
const pagination = ref<PaginationMeta>({
  total: 0,
  limit: 20,
  offset: 0,
  has_more: false
})

// Filters
const filters = ref<McpServerFilters>({
  visibility: 'global' // Only show global servers in admin catalog
})

// For search, we'll use client-side filtering since the backend pagination
// doesn't support search yet. In the future, this could be moved to server-side
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

// Computed values for pagination display
const displayedServers = computed(() => {
  // If searching, show filtered results without pagination
  if (searchQuery.value) {
    return filteredServers.value
  }
  // Otherwise show paginated results
  return servers.value
})


// Navigation handlers
const handleAddServer = () => {
  router.push('/admin/mcp-server-catalog/add')
}

const handleEditServer = (serverId: string) => {
  router.push(`/admin/mcp-server-catalog/view/${serverId}`)
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

    // Emit global event
    eventBus.emit('mcp-catalog-updated')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to update server'
  }
}


// Fetch servers from API with pagination
const fetchServers = async (): Promise<void> => {
  try {
    isLoading.value = true
    error.value = null

    const offset = (currentPage.value - 1) * pageSize.value
    const response = await McpCatalogService.getGlobalServersPaginated(
      filters.value,
      { limit: pageSize.value, offset }
    )

    servers.value = response.items
    pagination.value = response.pagination
    totalItems.value = response.pagination.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    servers.value = []
    totalItems.value = 0
  } finally {
    isLoading.value = false
  }
}

// Pagination event handlers
const handlePageChange = async (page: number) => {
  currentPage.value = page
  await fetchServers()
}

const handlePageSizeChange = async (newPageSize: number) => {
  pageSize.value = newPageSize
  currentPage.value = 1 // Reset to first page when changing page size
  await fetchServers()
}

// Handle server creation success from add page
const handleServerCreated = () => {
  fetchServers()
  successMessage.value = t('mcpCatalog.messages.createSuccess')
}

// Load data on component mount
onMounted(async () => {
  await fetchServers()

  // Check for delete success message from query parameters
  const deletedServerName = route.query.deleted as string
  if (deletedServerName) {
    successMessage.value = t('mcpCatalog.messages.deleteSuccess')

    // Clean up the query parameter
    router.replace({ query: {} })
  }

  // Check for create success message from query parameters
  const createdServer = route.query.created as string
  if (createdServer === 'true') {
    successMessage.value = t('mcpCatalog.messages.createSuccess')

    // Clean up the query parameters
    router.replace({ query: {} })
  }

  // Listen for catalog updates from other components
  eventBus.on('mcp-catalog-updated', () => {
    fetchServers()
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
          :servers="displayedServers"
          :on-edit-server="handleEditServer"
          :on-toggle-featured="handleToggleFeatured"
        />

        <!-- Pagination Controls (only show when not searching) -->
        <PaginationControls
          v-if="!searchQuery && totalItems > 0"
          :current-page="currentPage"
          :page-size="pageSize"
          :total-items="totalItems"
          :is-loading="isLoading"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
        />

        <!-- Search Results Info (show when searching) -->
        <div v-if="searchQuery" class="text-sm text-muted-foreground py-4">
          {{ t('mcpCatalog.pagination.showing', {
            start: filteredServers.length > 0 ? 1 : 0,
            end: filteredServers.length,
            total: filteredServers.length
          }) }}
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>
