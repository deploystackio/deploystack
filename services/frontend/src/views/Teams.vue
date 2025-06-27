<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
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
import { Plus } from 'lucide-vue-next'
import DashboardLayout from '@/components/DashboardLayout.vue'
import AddTeamModal from '@/components/teams/AddTeamModal.vue'
import { TeamService, type TeamWithRole, type Team } from '@/services/teamService'
import { UserService } from '@/services/userService'
import { useEventBus } from '@/composables/useEventBus'
import { createColumns } from './teams/columns'
import { useRouter, useRoute } from 'vue-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle } from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const eventBus = useEventBus()

// State
const teams = ref<TeamWithRole[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const sorting = ref<SortingState>([])
const columnFilters = ref<ColumnFiltersState>([])
const columnVisibility = ref<VisibilityState>({})
const rowSelection = ref({})
const showAddModal = ref(false)
const canCreateTeams = ref(false)
const userPermissions = ref<string[]>([])
const deleteSuccessMessage = ref<string | null>(null)

// Team switching state
const selectedTeam = ref<Team | null>(null)

// Handle manage team navigation
const handleManageTeam = (teamId: string) => {
  router.push(`/teams/manage/${teamId}`)
}

// Handle team switching
const handleSwitchTeam = (teamId: string) => {
  const team = teams.value.find(t => t.id === teamId)
  if (team) {
    selectedTeam.value = team
    // Emit global event for team selection to update sidebar
    eventBus.emit('team-selected', { teamId: team.id, teamName: team.name })
    console.log('Switched to team:', team.name)
  }
}

// Handle team selection from sidebar
const handleTeamSelectedFromSidebar = (data: { teamId: string; teamName: string }) => {
  // Find the team in our local teams list and update selectedTeam
  const team = teams.value.find(t => t.id === data.teamId)
  if (team) {
    selectedTeam.value = team
    console.log('Team selected from sidebar:', data.teamName)
  } else {
    // If team not found in current list, create a basic team object
    selectedTeam.value = { id: data.teamId, name: data.teamName } as Team
    console.log('Team selected from sidebar (not in current list):', data.teamName)
  }
}

// Check user permissions
const checkPermissions = async () => {
  try {
    const user = await UserService.getCurrentUser()
    if (user?.role?.permissions) {
      canCreateTeams.value = user.role.permissions.includes('teams.create')
      userPermissions.value = user.role.permissions
    }
  } catch (error) {
    console.error('Error checking permissions:', error)
    canCreateTeams.value = false
    userPermissions.value = []
  }
}

// Create columns with permissions
const columns = computed(() => createColumns(
  handleManageTeam,
  handleSwitchTeam,
  selectedTeam.value?.id || null,
  userPermissions.value
))

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

// Fetch teams from API
const fetchTeams = async (): Promise<void> => {
  try {
    isLoading.value = true
    error.value = null
    teams.value = await TeamService.getUserTeamsWithRoles()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    teams.value = []
  } finally {
    isLoading.value = false
  }
}

// Handle team creation success
const handleTeamCreated = async () => {
  await fetchTeams()
  // Emit global event to update sidebar and other components
  eventBus.emit('teams-updated')
}

// Check for delete success message from query params
const checkDeleteSuccess = () => {
  const deletedTeamName = route.query.deleted as string
  if (deletedTeamName) {
    deleteSuccessMessage.value = t('teams.messages.deleteSuccess', { teamName: deletedTeamName })

    // Clear the query parameter from URL
    router.replace({ path: '/teams' })

    // Clear the message after 5 seconds
    setTimeout(() => {
      deleteSuccessMessage.value = null
    }, 5000)
  }
}

// Load data on component mount
onMounted(async () => {
  // Check for delete success message first
  checkDeleteSuccess()

  await Promise.all([
    checkPermissions(),
    fetchTeams(),
    initializeSelectedTeam()
  ])

  // Listen for team selection events from sidebar
  eventBus.on('team-selected', handleTeamSelectedFromSidebar)

  // Listen for team updates from other components
  eventBus.on('teams-updated', () => {
    console.log('Teams updated event received, refreshing teams...')
    fetchTeams(true) // Force refresh to get latest data
  })
})

onUnmounted(() => {
  // Clean up event listeners to prevent memory leaks
  eventBus.off('team-selected', handleTeamSelectedFromSidebar)
  eventBus.off('teams-updated')
})

// Create table instance
const table = useVueTable({
  get data() {
    return teams.value
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

// Filter value for search
const filterValue = computed({
  get: () => (table.getColumn('name')?.getFilterValue() as string) ?? '',
  set: (value) => table.getColumn('name')?.setFilterValue(value),
})
</script>

<template>
  <DashboardLayout :title="t('teams.title')">
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <p class="text-muted-foreground">{{ t('teams.description') }}</p>
        </div>
        <Button
          v-if="canCreateTeams"
          @click="showAddModal = true"
          class="flex items-center gap-2"
        >
          <Plus class="h-4 w-4" />
          {{ t('teams.addButton') }}
        </Button>
      </div>

      <!-- Delete Success Message -->
      <Alert v-if="deleteSuccessMessage" class="border-green-200 bg-green-50 text-green-800">
        <CheckCircle class="h-4 w-4" />
        <AlertDescription>{{ deleteSuccessMessage }}</AlertDescription>
      </Alert>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-muted-foreground">
        {{ t('teams.table.loading') }}
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-red-500">
        {{ t('teams.table.error', { error }) }}
      </div>

      <!-- Data Table -->
      <div v-else class="space-y-4">
        <!-- Search Input -->
        <div class="flex items-center py-4">
          <Input
            :placeholder="t('teams.table.search.placeholder')"
            v-model="filterValue"
            class="max-w-sm"
          />
        </div>

        <!-- Table -->
        <div class="rounded-md border">
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
                    {{ t('teams.table.noResults') }}
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

      <!-- Add Team Modal -->
      <AddTeamModal
        v-model:open="showAddModal"
        @team-created="handleTeamCreated"
      />
    </div>
  </DashboardLayout>
</template>
