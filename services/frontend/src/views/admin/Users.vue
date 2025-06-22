<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
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
import DashboardLayout from '@/components/DashboardLayout.vue'
import { getEnv } from '@/utils/env'
import { createColumns } from './users/columns'
import type { User, UsersApiResponse } from './users/types'

const { t } = useI18n()
const router = useRouter()

const users = ref<User[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const sorting = ref<SortingState>([])
const columnFilters = ref<ColumnFiltersState>([])
const columnVisibility = ref<VisibilityState>({})
const rowSelection = ref({})

const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL') || ''

// Navigation function for viewing user details
const handleViewUser = (userId: string) => {
  router.push(`/admin/users/${userId}`)
}

// Create columns with navigation callback
const columns = createColumns(handleViewUser)

// Fetch users from API
async function fetchUsers(): Promise<User[]> {
  if (!apiUrl) {
    throw new Error('VITE_DEPLOYSTACK_BACKEND_URL is not configured.')
  }
  
  const response = await fetch(`${apiUrl}/api/users`, { 
    credentials: 'include' 
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to fetch users: ${response.statusText} (status: ${response.status})`)
  }

  const result: UsersApiResponse = await response.json()
  if (!result.success || !Array.isArray(result.data)) {
    throw new Error('API response for users was not successful or data format is incorrect.')
  }

  return result.data
}

// Load users on component mount
onMounted(async () => {
  try {
    isLoading.value = true
    users.value = await fetchUsers()
    error.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    users.value = []
  } finally {
    isLoading.value = false
  }
})

// Create table instance
const table = useVueTable({
  get data() {
    return users.value
  },
  get columns() {
    return columns
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
  get: () => (table.getColumn('email_username')?.getFilterValue() as string) ?? '',
  set: (value) => table.getColumn('email_username')?.setFilterValue(value),
})
</script>

<template>
  <DashboardLayout :title="t('adminUsers.title')">
    <div class="space-y-6">
      <!-- Header -->
      <div>
        <p class="text-muted-foreground">{{ t('adminUsers.description') }}</p>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-muted-foreground">
        {{ t('adminUsers.table.loading') }}
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-red-500">
        {{ t('adminUsers.table.error', { error }) }}
      </div>

      <!-- Data Table -->
      <div v-else class="space-y-4">
        <!-- Search Input -->
        <div class="flex items-center py-4">
          <Input
            :placeholder="t('adminUsers.table.search.placeholder')"
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
                    :colspan="columns.length"
                    class="h-24 text-center"
                  >
                    {{ t('adminUsers.table.noResults') }}
                  </TableCell>
                </TableRow>
              </template>
            </TableBody>
          </Table>
        </div>

        <!-- Pagination -->
        <div class="flex items-center justify-end space-x-2 py-4">
          <div class="flex-1 text-sm text-muted-foreground">
            {{ t('adminUsers.pagination.rowsSelected', {
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
              {{ t('adminUsers.pagination.previous') }}
            </Button>
            <Button
              variant="outline"
              size="sm"
              :disabled="!table.getCanNextPage()"
              @click="table.nextPage()"
            >
              {{ t('adminUsers.pagination.next') }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>
