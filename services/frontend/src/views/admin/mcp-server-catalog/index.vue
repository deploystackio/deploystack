<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { toast } from 'vue-sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Spinner } from '@/components/ui/spinner'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { DsPageHeading } from '@/components/ui/ds-page-heading'
import { McpCatalogService, type PaginationMeta } from '@/services/mcpCatalogService'
import { useEventBus } from '@/composables/useEventBus'
import McpServerTableColumns from './McpServerTableColumns.vue'
import PaginationControls from '@/components/ui/pagination/PaginationControls.vue'
import type { McpServer } from './types'
import type { McpServerSearchParams } from '@/types/mcp-catalog'
import { getEnv } from '@/utils/env'

const { t, tm } = useI18n()
const router = useRouter()
const route = useRoute()
const eventBus = useEventBus()
const { setBreadcrumbs } = useBreadcrumbs()

// State
const servers = ref<McpServer[]>([])
const isLoading = ref(true)
const isSearching = ref(false)
const error = ref<string | null>(null)
const deletedServerIds = ref<Set<string>>(new Set())

// Search and filter state
const searchQuery = ref('')
const selectedSource = ref<'all' | 'official_registry' | 'manual'>('all')
const selectedStatus = ref<'active' | 'deprecated' | 'maintenance' | 'disabled' | 'all'>('all')
const selectedLanguage = ref('all')
const selectedRuntime = ref('all')
const selectedFeatured = ref<'true' | 'false' | 'all'>('all')
const selectedAutoInstall = ref<'true' | 'false' | 'all'>('all')

// Available runtimes (fetched from API)
const availableRuntimes = ref<string[]>([])
const availableLanguages = ref<string[]>([])

// Sync state
const isSyncModalOpen = ref(false)
const isSyncing = ref(false)
const syncBatchId = ref<string | null>(null)
const syncPhase = ref<'idle' | 'coordinating' | 'syncing' | 'completed' | 'failed'>('idle')
const syncProgress = ref({ completed: 0, total: 0 })

// Sync form data
const syncFormData = ref({
  maxServers: 25,
  skipExisting: true,
  rateLimitDelay: 2
})

// Reset state when modal opens
watch(isSyncModalOpen, (isOpen) => {
  if (isOpen) {
    syncFormData.value = {
      maxServers: 25,
      skipExisting: true,
      rateLimitDelay: 2
    }
    syncPhase.value = 'idle'
    syncBatchId.value = null
    syncProgress.value = { completed: 0, total: 0 }
  }
})

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

// Selection state
const selectedServerIds = ref<string[]>([])

// Filter out servers that are queued for deletion
const visibleServers = computed(() => {
  return servers.value.filter(server => !deletedServerIds.value.has(server.id))
})

// Visible filters state (lifted from child to preserve across loading)
const visibleFilters = ref<Set<string>>(new Set())

// Filter values state (lifted from child to preserve across loading)
const filterValues = ref<Record<string, string>>({
  status: '',
  language: '',
  runtime: '',
  featured: '',
  autoInstall: '',
})

// Handle selection change from table
const handleSelectionChange = (selectedIds: string[]) => {
  selectedServerIds.value = selectedIds
}

// Handle visible filters change from table
const handleVisibleFiltersChange = (filters: Set<string>) => {
  visibleFilters.value = filters
}

// Handle filter values change from table
const handleFilterValuesChange = (values: Record<string, string>) => {
  filterValues.value = values
}

// Navigation handlers
const handleAddServer = () => {
  router.push('/admin/mcp-server-catalog/add')
}

const handleEditServer = (serverId: string) => {
  router.push(`/admin/mcp-server-catalog/view/${serverId}`)
}

const handleToggleStatus = async (serverId: string, newStatus: 'active' | 'disabled') => {
  try {
    await McpCatalogService.updateGlobalServerStatus(serverId, newStatus)

    if (newStatus === 'disabled') {
      toast.success(t('mcpCatalog.messages.disableSuccess'))
    } else {
      toast.success(t('mcpCatalog.messages.enableSuccess'))
    }

    // Refresh the table
    if (hasTextSearch()) {
      await searchServers()
    } else {
      await fetchServers()
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    toast.error(t('mcpCatalog.messages.statusChangeError', { error: errorMessage }))
  }
}

const handleDeleteServer = async (serverId: string): Promise<void> => {
  try {
    // Find server name for the toast message
    const server = servers.value.find(s => s.id === serverId)
    const serverName = server?.name || 'Unknown Server'

    await McpCatalogService.deleteGlobalServer(serverId)

    // Optimistically add to deleted IDs
    deletedServerIds.value.add(serverId)

    // Store in EventBus for persistence
    const deletedIds = Array.from(deletedServerIds.value)
    eventBus.setState('deleted_server_ids', deletedIds)

    // Clear selection if deleted server was selected
    selectedServerIds.value = selectedServerIds.value.filter(id => id !== serverId)

    toast.success(t('mcpCatalog.messages.deletionQueued', { name: serverName }))
  } catch (err) {
    // Remove from deleted IDs on error
    deletedServerIds.value.delete(serverId)

    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    toast.error(t('mcpCatalog.messages.deleteError', { error: errorMessage }))
    throw err // Re-throw so the dialog knows deletion failed
  }
}

const handleBulkDeleteServers = async (serverIds: string[]): Promise<void> => {
  try {
    const result = await McpCatalogService.bulkDeleteGlobalServers(serverIds)

    // Add queued servers to deleted IDs
    const queuedServerIds = new Set(result.jobs.map(job => job.server_id))
    queuedServerIds.forEach(id => deletedServerIds.value.add(id))

    // Update storage
    const deletedIds = Array.from(deletedServerIds.value)
    eventBus.setState('deleted_server_ids', deletedIds)

    // Update pagination count
    totalItems.value = Math.max(0, totalItems.value - result.total_queued)
    selectedServerIds.value = []

    if (result.total_skipped > 0) {
      toast.success(t('mcpCatalog.bulkDelete.partialSuccess', {
        queued: result.total_queued,
        skipped: result.total_skipped
      }))
    } else {
      toast.success(t('mcpCatalog.bulkDelete.success', {
        queued: result.total_queued
      }))
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    toast.error(t('mcpCatalog.bulkDelete.error', { error: errorMessage }))
    throw err // Re-throw so the dialog knows deletion failed
  }
}

// Sync registry handler
const handleSyncRegistry = async () => {
  try {
    isSyncing.value = true
    syncPhase.value = 'coordinating'

    const baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

    // Call backend sync endpoint with form data
    const response = await fetch(`${baseUrl}/api/admin/mcp-registry/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        maxServers: syncFormData.value.maxServers,
        skipExisting: syncFormData.value.skipExisting,
        rateLimitDelay: syncFormData.value.rateLimitDelay
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Sync failed')
    }

    const data = await response.json()
    syncBatchId.value = data.data.batchId

    // Show success toast with coordination message
    toast.success(t('mcpCatalog.registrySync.messages.coordinating'), {
      description: t('mcpCatalog.registrySync.messages.coordinatingDescription', {
        batchId: data.data.batchId
      })
    })

    // Start polling for progress
    startProgressPolling(data.data.batchId)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    syncPhase.value = 'failed'
    toast.error(t('mcpCatalog.registrySync.messages.error'), {
      description: t('mcpCatalog.registrySync.messages.errorDescription', {
        message: errorMessage
      })
    })
  } finally {
    isSyncing.value = false
  }
}

// Progress polling
let pollInterval: ReturnType<typeof setInterval> | null = null

const startProgressPolling = (batchId: string) => {
  if (pollInterval) {
    clearInterval(pollInterval)
  }

  pollInterval = setInterval(async () => {
    try {
      const baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')
      const response = await fetch(`${baseUrl}/api/admin/mcp-registry/progress/${batchId}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch progress')
      }

      const data = await response.json()
      const { batch, progress } = data.data

      // Coordination phase: total_jobs = 0
      if (batch.total_jobs === 0) {
        syncPhase.value = 'coordinating'
        return
      }

      // Syncing phase: total_jobs > 0
      syncPhase.value = 'syncing'
      syncProgress.value = {
        completed: progress.completed,
        total: progress.total
      }

      // Check completion
      if (batch.status === 'completed') {
        if (pollInterval) clearInterval(pollInterval)
        syncPhase.value = 'completed'
        isSyncModalOpen.value = false

        toast.success(t('mcpCatalog.registrySync.messages.completed'), {
          description: t('mcpCatalog.registrySync.messages.completedDescription', {
            count: progress.completed
          })
        })

        // Refresh catalog
        setTimeout(() => fetchServers(), 1000)
      } else if (batch.status === 'failed') {
        if (pollInterval) clearInterval(pollInterval)
        syncPhase.value = 'failed'

        toast.error(t('mcpCatalog.registrySync.messages.failed'))
      }
    } catch (error) {
      console.error('Failed to fetch sync progress:', error)
    }
  }, 2000)
}

// Cleanup on unmount
onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval)
  }
})


// Check if text search is active
const hasTextSearch = () => {
  return !!searchQuery.value && searchQuery.value.trim().length > 0
}

// Fetch servers using search API (only when text query exists)
const searchServers = async (): Promise<void> => {
  try {
    isLoading.value = true
    error.value = null

    const offset = (currentPage.value - 1) * pageSize.value

    const searchParams: McpServerSearchParams = {
      q: searchQuery.value.trim(), // Use actual search query
      limit: pageSize.value,
      offset
    }

    // Add filters if selected (skip 'all' values)
    if (selectedSource.value !== 'all') {
      searchParams.source = selectedSource.value
    }
    if (selectedStatus.value !== 'all') {
      searchParams.status = selectedStatus.value
    }
    if (selectedLanguage.value !== 'all') {
      searchParams.language = selectedLanguage.value
    }
    if (selectedRuntime.value !== 'all') {
      searchParams.runtime = selectedRuntime.value
    }
    if (selectedFeatured.value !== 'all') {
      searchParams.featured = selectedFeatured.value === 'true'
    }
    // Note: auto_install_new_default_team is not in the search API yet,
    // but we keep the UI ready for when it's added

    const response = await McpCatalogService.searchServers(searchParams)

    servers.value = response.servers
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

// Fetch servers from API with pagination and filters (non-search)
const fetchServers = async (): Promise<void> => {
  try {
    isLoading.value = true
    error.value = null

    const offset = (currentPage.value - 1) * pageSize.value

    // Build filters object
    const filters: Record<string, string> = {
      visibility: 'global'
    }

    // Add active filters
    if (selectedSource.value !== 'all') {
      filters.source = selectedSource.value
    }
    if (selectedStatus.value !== 'all') {
      filters.status = selectedStatus.value
    }
    if (selectedLanguage.value !== 'all') {
      filters.language = selectedLanguage.value
    }
    if (selectedRuntime.value !== 'all') {
      filters.runtime = selectedRuntime.value
    }
    if (selectedFeatured.value !== 'all') {
      filters.featured = selectedFeatured.value
    }
    if (selectedAutoInstall.value !== 'all') {
      filters.auto_install_new_default_team = selectedAutoInstall.value
    }

    const response = await McpCatalogService.getGlobalServersPaginated(
      filters,
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


const executeSearch = async () => {
  isSearching.value = true
  currentPage.value = 1 // Reset to first page on new search

  try {
    // Use search API only when there's a text query
    // Otherwise use regular list API with filters
    if (hasTextSearch()) {
      await searchServers()
    } else {
      await fetchServers()
    }
  } finally {
    isSearching.value = false
  }
}

// Handle source filter change from tabs
const handleSourceChange = async (source: 'all' | 'official_registry' | 'manual') => {
  selectedSource.value = source
  selectedServerIds.value = [] // Clear selection when switching source
  currentPage.value = 1
  if (hasTextSearch()) {
    await searchServers()
  } else {
    await fetchServers()
  }
}

// Handle filter change from McpServerTableColumns
const handleFilterChange = async (filters: Record<string, string>) => {
  // Map filter values from child component to parent state
  selectedStatus.value = (filters.status as typeof selectedStatus.value) || 'all'
  selectedLanguage.value = filters.language || 'all'
  selectedRuntime.value = filters.runtime || 'all'

  // Map 'yes'/'no' to 'true'/'false' for featured and autoInstall
  if (filters.featured === 'yes') {
    selectedFeatured.value = 'true'
  } else if (filters.featured === 'no') {
    selectedFeatured.value = 'false'
  } else {
    selectedFeatured.value = 'all'
  }

  if (filters.autoInstall === 'yes') {
    selectedAutoInstall.value = 'true'
  } else if (filters.autoInstall === 'no') {
    selectedAutoInstall.value = 'false'
  } else {
    selectedAutoInstall.value = 'all'
  }

  // Execute search with new filters
  await executeSearch()
}

// Note: Removed automatic watch-based search execution
// Search now requires explicit button click via executeSearch()

// Pagination event handlers
const handlePageChange = async (page: number) => {
  currentPage.value = page
  if (hasTextSearch()) {
    await searchServers()
  } else {
    await fetchServers()
  }
}

const handlePageSizeChange = async (newPageSize: number) => {
  pageSize.value = newPageSize
  currentPage.value = 1
  if (hasTextSearch()) {
    await searchServers()
  } else {
    await fetchServers()
  }
}

// Handle server creation success from add page
const handleServerCreated = () => {
  fetchServers()
  toast.success(t('mcpCatalog.messages.createSuccess'))
}

// Fetch available runtimes
const fetchRuntimes = async () => {
  try {
    availableRuntimes.value = await McpCatalogService.getRuntimes()
  } catch (err) {
    console.error('Failed to fetch runtimes:', err)
    availableRuntimes.value = []
  }
}

// Fetch available languages
const fetchLanguages = async () => {
  try {
    availableLanguages.value = await McpCatalogService.getLanguages()
  } catch (err) {
    console.error('Failed to fetch languages:', err)
    availableLanguages.value = []
  }
}

// Load data on component mount
onMounted(async () => {
  setBreadcrumbs([{ label: t('mcpCatalog.title') }])

  // Load deleted IDs from storage on mount
  const storedDeletedIds = eventBus.getState<string[]>('deleted_server_ids', []) || []
  deletedServerIds.value = new Set(storedDeletedIds)

  // Check for deletion query params
  const deletedId = route.query.deletedId as string
  if (deletedId) {
    deletedServerIds.value.add(deletedId)
  }

  await Promise.all([
    fetchServers(),
    fetchRuntimes(),
    fetchLanguages()
  ])

  // Check for deletion queued message from query parameters
  const deletionQueuedServerName = route.query.deletionQueued as string
  if (deletionQueuedServerName) {
    toast.success(t('mcpCatalog.messages.deletionQueued', { name: deletionQueuedServerName }))

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

  // Listen for MCP_SERVER_DELETED event to clean up
  eventBus.on('mcp-server-deleted', (data: { serverId?: string; server?: { id: string } }) => {
    // Remove from deleted IDs when actually deleted
    const serverId = data.serverId || data.server?.id
    if (serverId) {
      deletedServerIds.value.delete(serverId)

      // Update storage
      const deletedIds = Array.from(deletedServerIds.value)
      eventBus.setState('deleted_server_ids', deletedIds)
    }
  })
})

onUnmounted(() => {
  // Clean up event listeners
  eventBus.off('mcp-catalog-updated')
  eventBus.off('mcp-server-created', handleServerCreated)
  eventBus.off('mcp-server-deleted')
})
</script>

<template>
  <NavbarLayout>
    <DsPageHeading :title="t('mcpCatalog.title')">
      <template #actions>
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
      </template>
    </DsPageHeading>

    <div class="space-y-6 mt-6">
      <!-- Error State -->
      <div v-if="error" class="text-red-500">
        {{ t('mcpCatalog.table.error', { error }) }}
      </div>

      <!-- Data Table -->
      <div v-else class="space-y-4">
        <!-- Servers Table Component -->
        <McpServerTableColumns
          :is-loading="isLoading"
          :servers="visibleServers"
          :selected-source="selectedSource"
          :search-query="searchQuery"
          :is-searching="isSearching"
          :visible-filters="visibleFilters"
          :filter-values="filterValues"
          :on-edit-server="handleEditServer"
          :on-toggle-status="handleToggleStatus"
          :on-delete-server="handleDeleteServer"
          @selection-change="handleSelectionChange"
          @bulk-delete="handleBulkDeleteServers"
          @source-change="handleSourceChange"
          @update:search-query="(value) => searchQuery = value"
          @search="executeSearch"
          @filter-change="handleFilterChange"
          @visible-filters-change="handleVisibleFiltersChange"
          @filter-values-change="handleFilterValuesChange"
        />

        <!-- Pagination Controls -->
        <PaginationControls
          v-if="totalItems > 0"
          :current-page="currentPage"
          :page-size="pageSize"
          :total-items="totalItems"
          :is-loading="isLoading"
          :selected-count="selectedServerIds.length"
          :total-rows="servers.length"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
        />
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

          <!-- Form Fields -->
          <div class="space-y-4">
            <!-- Max Servers -->
            <div class="space-y-2">
              <Label for="maxServers">{{ t('mcpCatalog.registrySync.modal.form.maxServers.label') }}</Label>
              <Input
                id="maxServers"
                v-model.number="syncFormData.maxServers"
                type="number"
                min="1"
                :placeholder="t('mcpCatalog.registrySync.modal.form.maxServers.placeholder')"
              />
              <p class="text-sm text-muted-foreground">
                {{ t('mcpCatalog.registrySync.modal.form.maxServers.description') }}
              </p>
            </div>

            <!-- Rate Limit Delay -->
            <div class="space-y-2">
              <Label for="rateLimitDelay">{{ t('mcpCatalog.registrySync.modal.form.rateLimitDelay.label') }}</Label>
              <Input
                id="rateLimitDelay"
                v-model.number="syncFormData.rateLimitDelay"
                type="number"
                min="0"
                step="0.5"
                :placeholder="t('mcpCatalog.registrySync.modal.form.rateLimitDelay.placeholder')"
              />
              <p class="text-sm text-muted-foreground">
                {{ t('mcpCatalog.registrySync.modal.form.rateLimitDelay.description') }}
              </p>
            </div>

            <!-- Skip Existing Checkbox -->
            <div class="flex items-start space-x-3">
              <Checkbox
                id="skipExisting"
                v-model="syncFormData.skipExisting"
              />
              <Label
                for="skipExisting"
                class="cursor-pointer font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {{ t('mcpCatalog.registrySync.modal.form.skipExisting.label') }}
              </Label>
            </div>
          </div>

          <!-- Status Display -->
          <div v-if="syncPhase !== 'idle'" class="space-y-3 border-t pt-4">
            <!-- Coordinating Phase -->
            <div v-if="syncPhase === 'coordinating'" class="flex items-start gap-3">
              <RefreshCw class="h-5 w-5 text-primary animate-spin mt-0.5" />
              <div class="flex-1">
                <p class="text-sm font-medium">{{ t('mcpCatalog.registrySync.status.coordinating.title') }}</p>
                <p class="text-sm text-muted-foreground">{{ t('mcpCatalog.registrySync.status.coordinating.description') }}</p>
              </div>
            </div>

            <!-- Syncing Phase -->
            <div v-if="syncPhase === 'syncing'" class="space-y-2">
              <div class="flex items-center justify-between">
                <p class="text-sm font-medium">{{ t('mcpCatalog.registrySync.status.syncing.title') }}</p>
                <p class="text-sm text-muted-foreground">{{ syncProgress.completed }} / {{ syncProgress.total }}</p>
              </div>
              <div class="w-full bg-muted rounded-full h-2">
                <div
                  class="bg-primary h-2 rounded-full transition-all duration-300"
                  :style="{ width: `${(syncProgress.completed / syncProgress.total * 100)}%` }"
                ></div>
              </div>
            </div>
          </div>

          <!-- Explanation (only when idle) -->
          <div v-if="syncPhase === 'idle'" class="space-y-2">
            <p class="text-sm font-medium">{{ t('mcpCatalog.registrySync.modal.explanation') }}</p>
            <ul class="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li v-for="(step, index) in tm('mcpCatalog.registrySync.modal.steps') as string[]" :key="index">
                {{ step }}
              </li>
            </ul>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel :disabled="isSyncing || syncPhase === 'syncing'">
            {{ syncPhase === 'completed' ? t('mcpCatalog.registrySync.modal.close') : t('mcpCatalog.registrySync.modal.cancel') }}
          </AlertDialogCancel>
          <AlertDialogAction
            v-if="syncPhase === 'idle'"
            as-child
          >
            <Button
              @click="handleSyncRegistry"
              :disabled="isSyncing"
            >
              <Spinner v-if="isSyncing" class="mr-2" />
              {{ t('mcpCatalog.registrySync.modal.confirm') }}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </NavbarLayout>
</template>
