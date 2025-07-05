<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  FlexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/vue-table'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Loader2, Search } from 'lucide-vue-next'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { CredentialsService } from '@/services/credentialsService'
import { UserService } from '@/services/userService'
import { TeamService, type Team } from '@/services/teamService'
import { useEventBus } from '@/composables/useEventBus'
import type { CloudCredential, CloudCredentialBasic } from '@/types/credentials'
import { createColumns } from '@/components/credentials/columns'
import AddCredentialDialog from '@/components/credentials/AddCredentialDialog.vue'

// Simple debounce function
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: ReturnType<typeof setTimeout>
  return ((...args: any[]) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }) as T
}

const { t } = useI18n()
const eventBus = useEventBus()

// State
const credentials = ref<CloudCredential[]>([])
const searchResults = ref<CloudCredentialBasic[]>([])
const isLoading = ref(true)
const isSearching = ref(false)
const error = ref<string | null>(null)
const sorting = ref<SortingState>([])
const columnFilters = ref<ColumnFiltersState>([])
const columnVisibility = ref<VisibilityState>({})
const rowSelection = ref({})
const showAddModal = ref(false)
const canCreateCredentials = ref(false)
const userPermissions = ref<string[]>([])
const searchQuery = ref('')

// Team context (same pattern as teams page)
const selectedTeam = ref<Team | null>(null)

// Handle team selection from sidebar
const handleTeamSelected = async (data: { teamId: string; teamName: string }) => {
  // Find the full team object with role information
  try {
    const userTeams = await TeamService.getUserTeams()
    const fullTeam = userTeams.find(t => t.id === data.teamId)
    if (fullTeam) {
      selectedTeam.value = fullTeam
    } else {
      selectedTeam.value = { id: data.teamId, name: data.teamName } as Team
    }

    fetchCredentials() // Reload credentials for new team
    checkTeamPermissions() // Check permissions for new team
  } catch (error) {
    console.error('Error handling team selection:', error)
    selectedTeam.value = { id: data.teamId, name: data.teamName } as Team
    fetchCredentials()
  }
}

// Initialize selected team from sidebar teams
const initializeSelectedTeam = async () => {
  try {
    const userTeams = await TeamService.getUserTeams()
    if (userTeams.length > 0) {
      selectedTeam.value = userTeams[0] // Default to first team
    }
  } catch (error) {
    console.error('Error initializing selected team:', error)
  }
}

// Check user permissions
const checkPermissions = async () => {
  try {
    const user = await UserService.getCurrentUser()
    if (user?.role?.permissions) {
      // Global admins can always create credentials
      const isGlobalAdmin = user.role.permissions.includes('system.admin')
      canCreateCredentials.value = isGlobalAdmin
      userPermissions.value = user.role.permissions
    }
  } catch (error) {
    console.error('Error checking permissions:', error)
    canCreateCredentials.value = false
    userPermissions.value = []
  }
}

// Check team-specific permissions using the role info from teams data
const checkTeamPermissions = () => {
  if (!selectedTeam.value) return

  // Check if user is team admin for the selected team
  const isTeamAdmin = selectedTeam.value.is_admin || selectedTeam.value.role === 'team_admin'
  const isGlobalAdmin = userPermissions.value.includes('system.admin')

  canCreateCredentials.value = isTeamAdmin || isGlobalAdmin
}

// Fetch credentials from API
const fetchCredentials = async (forceRefresh = false): Promise<void> => {
  if (!selectedTeam.value) return

  try {
    isLoading.value = true
    error.value = null

    credentials.value = await CredentialsService.getTeamCredentials(selectedTeam.value.id)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    credentials.value = []
  } finally {
    isLoading.value = false
  }
}

// Debounced search
const debouncedSearch = debounce(async (query: string) => {
  if (!selectedTeam.value || !query.trim()) {
    searchResults.value = []
    return
  }

  try {
    isSearching.value = true
    searchResults.value = await CredentialsService.searchCredentials(
      selectedTeam.value.id,
      query.trim()
    )
  } catch (error) {
    console.error('Search error:', error)
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}, 300)

// Manual search function for button click
const handleManualSearch = async () => {
  if (!selectedTeam.value || !searchQuery.value.trim()) {
    searchResults.value = []
    return
  }

  try {
    isSearching.value = true
    searchResults.value = await CredentialsService.searchCredentials(
      selectedTeam.value.id,
      searchQuery.value.trim()
    )
  } catch (error) {
    console.error('Search error:', error)
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

// Watch search query
watch(searchQuery, (newQuery) => {
  if (newQuery.trim()) {
    debouncedSearch(newQuery)
  } else {
    searchResults.value = []
  }
})

// Display data: use search results if searching, otherwise all credentials
const displayCredentials = computed(() => {
  return searchQuery.value.trim() ? searchResults.value : credentials.value
})

// Handle credential actions
const handleEditCredential = (credentialId: string) => {
  // TODO: Implement edit functionality
  console.log('Edit credential:', credentialId)
}

const handleDeleteCredential = async (credentialId: string) => {
  if (!selectedTeam.value) return

  try {
    await CredentialsService.deleteCredential(selectedTeam.value.id, credentialId)

    // Emit events
    eventBus.emit('credentials-updated')

    // Refresh credentials list
    await fetchCredentials()
  } catch (error) {
    console.error('Error deleting credential:', error)
    // TODO: Show error notification
  }
}

// Create columns with permissions
const columns = computed(() => createColumns(
  handleEditCredential,
  handleDeleteCredential,
  userPermissions.value
))

// Handle credential creation success
const handleCredentialCreated = async () => {
  await fetchCredentials()
  // Emit global event to update other components
  eventBus.emit('credentials-updated')
}

// Load data on component mount
onMounted(async () => {
  await Promise.all([
    checkPermissions(),
    initializeSelectedTeam()
  ])

  // Initial fetch after team is set
  if (selectedTeam.value) {
    await fetchCredentials()
    await checkTeamPermissions()
  }

  // Listen for team selection events from sidebar
  eventBus.on('team-selected', handleTeamSelected)

  // Listen for credential updates from other components
  eventBus.on('credentials-updated', () => {
    fetchCredentials(true) // Force refresh to get latest data
  })
})

onUnmounted(() => {
  // Clean up event listeners to prevent memory leaks
  eventBus.off('team-selected', handleTeamSelected)
  eventBus.off('credentials-updated')
})

// Create table instance
const table = useVueTable({
  get data() {
    return displayCredentials.value
  },
  get columns() {
    return columns.value
  },
  onSortingChange: (updaterOrValue) => {
    sorting.value = typeof updaterOrValue === 'function'
      ? updaterOrValue(sorting.value)
      : updaterOrValue
  },
  onColumnFiltersChange: (updaterOrValue) => {
    columnFilters.value = typeof updaterOrValue === 'function'
      ? updaterOrValue(columnFilters.value)
      : updaterOrValue
  },
  onColumnVisibilityChange: (updaterOrValue) => {
    columnVisibility.value = typeof updaterOrValue === 'function'
      ? updaterOrValue(columnVisibility.value)
      : updaterOrValue
  },
  onRowSelectionChange: (updaterOrValue) => {
    rowSelection.value = typeof updaterOrValue === 'function'
      ? updaterOrValue(rowSelection.value)
      : updaterOrValue
  },
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  state: {
    get sorting() {
      return sorting.value
    },
    get columnFilters() {
      return columnFilters.value
    },
    get columnVisibility() {
      return columnVisibility.value
    },
    get rowSelection() {
      return rowSelection.value
    },
  },
})
</script>

<template>
  <DashboardLayout :title="t('credentials.title')">
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <p class="text-muted-foreground">{{ t('credentials.description') }}</p>
        </div>
        <Button
          v-if="canCreateCredentials && selectedTeam"
          @click="showAddModal = true"
          class="flex items-center gap-2"
        >
          <Plus class="h-4 w-4" />
          {{ t('credentials.addButton') }}
        </Button>
      </div>

      <!-- No team selected state -->
      <div v-if="!selectedTeam" class="text-center py-12">
        <p class="text-muted-foreground">{{ t('credentials.permissions.noAccess') }}</p>
      </div>

      <!-- Loading State -->
      <div v-else-if="isLoading" class="text-muted-foreground">
        {{ t('credentials.table.loading') }}
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-red-500">
        {{ t('credentials.table.error', { error }) }}
      </div>

      <!-- Data Table -->
      <div v-else class="space-y-4">
        <!-- Search Input with Button -->
        <div class="flex items-center py-4">
          <div class="flex max-w-sm">
            <Input
              :placeholder="t('credentials.search.placeholder')"
              v-model="searchQuery"
              class="rounded-r-none border-r-0 focus:z-10"
              @keyup.enter="handleManualSearch"
            />
            <Button
              variant="outline"
              class="rounded-l-none border-l-0 px-3"
              @click="handleManualSearch"
              :disabled="isSearching"
            >
              <Loader2 v-if="isSearching" class="h-4 w-4 animate-spin" />
              <Search v-else class="h-4 w-4" />
              <span class="sr-only">{{ t('credentials.search.button') }}</span>
            </Button>
          </div>
        </div>

        <!-- Search results count -->
        <div v-if="searchQuery.trim()" class="text-sm text-muted-foreground">
          {{ t('credentials.search.results', {
            count: searchResults.length,
            query: searchQuery
          }) }}
        </div>

        <!-- Empty state -->
        <div v-if="displayCredentials.length === 0 && !searchQuery.trim()" class="text-center py-12">
          <div class="space-y-4">
            <h3 class="text-lg font-medium">{{ t('credentials.empty.title') }}</h3>
            <p class="text-muted-foreground">{{ t('credentials.empty.description') }}</p>
            <Button
              v-if="canCreateCredentials"
              @click="showAddModal = true"
              class="flex items-center gap-2"
            >
              <Plus class="h-4 w-4" />
              {{ t('credentials.empty.action') }}
            </Button>
          </div>
        </div>

        <!-- Table -->
        <div v-else class="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow
                v-for="headerGroup in table.getHeaderGroups()"
                :key="headerGroup.id"
              >
                <TableHead
                  v-for="header in headerGroup.headers"
                  :key="header.id"
                  :class="header.id === 'actions' ? 'text-right' : ''"
                >
                  <FlexRender
                    v-if="!header.isPlaceholder"
                    :render="header.column.columnDef.header"
                    :props="header.getContext()"
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <template v-if="table.getRowModel().rows?.length">
                <TableRow
                  v-for="row in table.getRowModel().rows"
                  :key="row.id"
                  :data-state="row.getIsSelected() && 'selected'"
                >
                  <TableCell
                    v-for="cell in row.getVisibleCells()"
                    :key="cell.id"
                  >
                    <FlexRender
                      :render="cell.column.columnDef.cell"
                      :props="cell.getContext()"
                    />
                  </TableCell>
                </TableRow>
              </template>
              <template v-else>
                <TableRow>
                  <TableCell
                    :colspan="table.getAllColumns().length"
                    class="h-24 text-center"
                  >
                    {{ searchQuery.trim() ? t('credentials.search.noResults') : t('credentials.table.noResults') }}
                  </TableCell>
                </TableRow>
              </template>
            </TableBody>
          </Table>
        </div>

        <!-- Pagination -->
        <div class="flex items-center justify-end space-x-2 py-4">
          <div class="flex-1 text-sm text-muted-foreground">
            {{ t('teams.pagination.rowsSelected', {
              selected: table.getFilteredSelectedRowModel().rows.length,
              total: table.getFilteredRowModel().rows.length
            }) }}
          </div>
          <div class="space-x-2">
            <Button
              variant="outline"
              size="sm"
              :disabled="!table.getCanPreviousPage()"
              @click="table.previousPage()"
            >
              {{ t('teams.pagination.previous') }}
            </Button>
            <Button
              variant="outline"
              size="sm"
              :disabled="!table.getCanNextPage()"
              @click="table.nextPage()"
            >
              {{ t('teams.pagination.next') }}
            </Button>
          </div>
        </div>
      </div>

      <!-- Add Credential Dialog -->
      <AddCredentialDialog
        v-model:open="showAddModal"
        :team-id="selectedTeam?.id"
        @credential-created="handleCredentialCreated"
      />
    </div>
  </DashboardLayout>
</template>
