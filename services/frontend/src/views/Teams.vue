<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
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
import { TeamService, type TeamWithRole } from '@/services/teamService'
import { UserService } from '@/services/userService'
import { createColumns } from './teams/columns'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const router = useRouter()

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

// Handle manage team navigation
const handleManageTeam = (teamId: string) => {
  router.push(`/teams/manage/${teamId}`)
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
const columns = computed(() => createColumns(handleManageTeam, userPermissions.value))

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
  // Also refresh the sidebar teams
  await TeamService.getUserTeams(true)
}

// Load data on component mount
onMounted(async () => {
  await Promise.all([
    checkPermissions(),
    fetchTeams()
  ])
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
