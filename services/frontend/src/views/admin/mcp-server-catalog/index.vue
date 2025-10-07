<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
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
              :loading="isSyncing"
              :loading-text="t('mcpCatalog.registrySync.modal.starting')"
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
