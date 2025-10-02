<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, RefreshCw, ExternalLink } from 'lucide-vue-next'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { McpCatalogService, type PaginationMeta } from '@/services/mcpCatalogService'
import { useEventBus } from '@/composables/useEventBus'
import McpServerTableColumns from './McpServerTableColumns.vue'
import PaginationControls from '@/components/ui/pagination/PaginationControls.vue'
import type { McpServer, McpServerFilters } from './types'
import { getEnv } from '@/utils/env'

const { t, tm } = useI18n()
const router = useRouter()
const route = useRoute()
const eventBus = useEventBus()

// State
const servers = ref<McpServer[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')

// Sync state
const isSyncModalOpen = ref(false)
const isSyncing = ref(false)

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
    server.language.toLowerCase().includes(query)
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

// Sync registry handler
const handleSyncRegistry = async () => {
  try {
    isSyncing.value = true

    const baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

    // Call backend sync endpoint with test limit
    const response = await fetch(`${baseUrl}/api/admin/mcp-registry/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        maxServers: 3,
        skipExisting: true,
        rateLimitDelay: 2
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Sync failed')
    }

    const data = await response.json()

    // Close modal and show success
    isSyncModalOpen.value = false
    toast.success(t('mcpCatalog.registrySync.messages.success'), {
      description: t('mcpCatalog.registrySync.messages.successDescription', {
        count: data.data.totalServers,
        batchId: data.data.batchId
      })
    })

    // Optionally refresh the catalog after a delay
    setTimeout(() => fetchServers(), 3000)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    toast.error(t('mcpCatalog.registrySync.messages.error'), {
      description: t('mcpCatalog.registrySync.messages.errorDescription', {
        message: errorMessage
      })
    })
  } finally {
    isSyncing.value = false
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
  toast.success(t('mcpCatalog.messages.createSuccess'))
}

// Load data on component mount
onMounted(async () => {
  await fetchServers()

  // Check for delete success message from query parameters
  const deletedServerName = route.query.deleted as string
  if (deletedServerName) {
    toast.success(t('mcpCatalog.messages.deleteSuccess'))

    // Clean up the query parameter
    router.replace({ query: {} })
  }

  // Check for create success message from query parameters
  const createdServer = route.query.created as string
  if (createdServer === 'true') {
    toast.success(t('mcpCatalog.messages.createSuccess'))

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
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            @click="isSyncModalOpen = true"
            class="flex items-center gap-2"
          >
            <RefreshCw class="h-4 w-4" />
            {{ t('mcpCatalog.registrySync.button') }}
          </Button>
          <Button
            @click="handleAddServer"
            class="flex items-center gap-2"
          >
            <Plus class="h-4 w-4" />
            {{ t('mcpCatalog.addButton') }}
          </Button>
        </div>
      </div>

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

    <!-- Sync Registry Modal -->
    <AlertDialog :open="isSyncModalOpen" @update:open="(value) => isSyncModalOpen = value">
      <AlertDialogContent class="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('mcpCatalog.registrySync.modal.title') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('mcpCatalog.registrySync.modal.description') }}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div class="space-y-4 py-4">
          <!-- Registry URL -->
          <div class="space-y-2">
            <p class="text-sm font-medium">{{ t('mcpCatalog.registrySync.modal.registryInfo') }}</p>
            <a
              :href="t('mcpCatalog.registrySync.modal.registryUrl')"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              {{ t('mcpCatalog.registrySync.modal.registryUrl') }}
              <ExternalLink class="h-3 w-3" />
            </a>
          </div>

          <!-- Explanation -->
          <div class="space-y-2">
            <p class="text-sm font-medium">{{ t('mcpCatalog.registrySync.modal.explanation') }}</p>
            <ul class="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li v-for="(step, index) in tm('mcpCatalog.registrySync.modal.steps') as string[]" :key="index">
                {{ step }}
              </li>
            </ul>
          </div>

          <!-- Note -->
          <div class="rounded-md bg-muted p-3">
            <p class="text-sm text-muted-foreground">
              {{ t('mcpCatalog.registrySync.modal.note') }}
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel :disabled="isSyncing">
            {{ t('mcpCatalog.registrySync.modal.cancel') }}
          </AlertDialogCancel>
          <AlertDialogAction
            as-child
          >
            <Button
              @click="handleSyncRegistry"
              :loading="isSyncing"
              :loading-text="t('mcpCatalog.registrySync.modal.syncing')"
              :disabled="isSyncing"
            >
              {{ t('mcpCatalog.registrySync.modal.confirm') }}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </DashboardLayout>
</template>
