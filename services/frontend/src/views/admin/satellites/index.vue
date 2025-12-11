<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { toast } from 'vue-sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { RefreshCw, Key } from 'lucide-vue-next'
import NavbarLayout from '@/components/NavbarLayout.vue'
import SatelliteTableColumns from './SatelliteTableColumns.vue'
import { SatelliteService, type Satellite, type SatelliteListParams } from '@/services/satelliteService'
import { useEventBus } from '@/composables/useEventBus'

const { t } = useI18n()
const eventBus = useEventBus()
const { setBreadcrumbs } = useBreadcrumbs()

// State
const satellites = ref<Satellite[]>([])
const isLoading = ref(true)
const isRefreshing = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')
const statusFilter = ref<string>('')
const typeFilter = ref<string>('')
const canManageSatellites = ref(true) // Trust router-level permission checking

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(20)
const totalItems = ref(0)
const totalPages = ref(0)

// Filter satellites based on search query and filters
const filteredSatellites = computed(() => {
  let filtered = satellites.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(satellite =>
      satellite.name.toLowerCase().includes(query)
    )
  }

  return filtered
})


// Fetch satellites from API
const fetchSatellites = async (forceRefresh = false): Promise<void> => {
  try {
    if (!forceRefresh) {
      isLoading.value = true
    } else {
      isRefreshing.value = true
    }
    error.value = null

    const params: SatelliteListParams = {
      page: currentPage.value,
      limit: itemsPerPage.value
    }

    if (statusFilter.value) {
      params.status = statusFilter.value
    }

    if (typeFilter.value) {
      params.satellite_type = typeFilter.value
    }

    if (searchQuery.value) {
      params.search = searchQuery.value
    }

    const response = await SatelliteService.getSatellites(params, forceRefresh)

    if (response.success) {
      satellites.value = response.data.satellites
      totalItems.value = response.data.pagination.total
      totalPages.value = response.data.pagination.pages
    } else {
      throw new Error('Failed to fetch satellites')
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred'
    error.value = errorMessage
    satellites.value = []

    // Show error toast for fetch failures
    toast.error(t('satellites.messages.fetchError'), {
      description: errorMessage
    })
  } finally {
    isLoading.value = false
    isRefreshing.value = false
  }
}

// Handle satellite status update
const handleStatusUpdate = async (satelliteId: string, newStatus: Satellite['status']) => {
  try {
    const response = await SatelliteService.updateSatelliteStatus(satelliteId, newStatus)

    if (response.success) {
      // Update local state
      const satelliteIndex = satellites.value.findIndex(s => s.id === satelliteId)
      if (satelliteIndex !== -1) {
        satellites.value[satelliteIndex] = response.data.satellite
      }

      // Show success toast
      toast.success(t('satellites.messages.statusUpdateSuccess'), {
        description: response.message
      })

      // Emit global event
      eventBus.emit('mcp-catalog-updated')
    } else {
      throw new Error('Failed to update satellite status')
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to update satellite status'
    toast.error(t('satellites.messages.statusUpdateError'), {
      description: errorMessage
    })
  }
}

// Handle refresh
const handleRefresh = async () => {
  await fetchSatellites(true)
}

// Handle search
const handleSearch = () => {
  currentPage.value = 1
  fetchSatellites()
}

// Handle pagination
const handlePageChange = (page: number) => {
  currentPage.value = page
  fetchSatellites()
}

// Load data on component mount
onMounted(async () => {
  setBreadcrumbs([{ label: t('satellites.title') }])

  // Fetch satellites (router already verified permissions)
  await fetchSatellites()

  // Listen for satellite updates from other components
  eventBus.on('mcp-catalog-updated', () => {
    fetchSatellites(true)
  })
})

onUnmounted(() => {
  // Clean up event listeners
  eventBus.off('mcp-catalog-updated')
})
</script>

<template>
  <NavbarLayout>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex-1">
          <p class="text-muted-foreground">{{ t('satellites.description') }}</p>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Button
            @click="$router.push('/admin/satellites/pairing')"
            variant="outline"
            class="flex items-center justify-center gap-2 bg-black text-white border-black hover:bg-black/90 hover:border-black hover:text-white"
          >
            <Key class="h-4 w-4" />
            {{ t('satellites.actions.pairing') }}
          </Button>
          <Button
            @click="handleRefresh"
            :disabled="isRefreshing"
            class="flex items-center justify-center gap-2"
          >
            <RefreshCw :class="{ 'animate-spin': isRefreshing }" class="h-4 w-4" />
            {{ t('satellites.actions.refresh') }}
          </Button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-muted-foreground">
        {{ t('satellites.table.loading') }}
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-red-500">
        {{ t('satellites.table.error', { error }) }}
      </div>

      <!-- Data Table -->
      <div v-else class="space-y-4">
        <!-- Search Input -->
        <div class="flex items-center py-4">
          <Input
            :placeholder="t('satellites.table.search.placeholder')"
            v-model="searchQuery"
            @keyup.enter="handleSearch"
            class="max-w-sm"
          />
        </div>

        <!-- Satellites Table Component -->
        <SatelliteTableColumns
          :satellites="filteredSatellites"
          :on-status-update="handleStatusUpdate"
          :can-manage-satellites="canManageSatellites"
        />

        <!-- Pagination Info -->
        <div v-if="totalItems > 0" class="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            {{ t('satellites.pagination.showing', {
              start: (currentPage - 1) * itemsPerPage + 1,
              end: Math.min(currentPage * itemsPerPage, totalItems),
              total: totalItems
            }) }}
          </div>
          <div class="flex items-center gap-2">
            <Button
              @click="handlePageChange(currentPage - 1)"
              :disabled="currentPage <= 1"
              variant="outline"
              size="sm"
            >
              {{ t('satellites.pagination.previous') }}
            </Button>
            <span>{{ t('satellites.pagination.page', { current: currentPage, total: totalPages }) }}</span>
            <Button
              @click="handlePageChange(currentPage + 1)"
              :disabled="currentPage >= totalPages"
              variant="outline"
              size="sm"
            >
              {{ t('satellites.pagination.next') }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </NavbarLayout>
</template>
