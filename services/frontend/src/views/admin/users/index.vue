<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { DsPageHeading } from '@/components/ui/ds-page-heading'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { UserService } from '@/services/userService'
import { UserTableColumns } from '@/components/admin/users'
import PaginationControls from '@/components/ui/pagination/PaginationControls.vue'
import type { User, PaginationMeta, UserSearchParams } from './types'

const { t } = useI18n()
const router = useRouter()
const { setBreadcrumbs } = useBreadcrumbs()

// State
const users = ref<User[]>([])
const isLoading = ref(true)
const isSearching = ref(false)
const error = ref<string | null>(null)

// Search and filter state
const searchQuery = ref('')
const searchType = ref<'username' | 'email'>('username')

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

// Visible filters state (lifted from child)
const visibleFilters = ref<Set<string>>(new Set())
const filterValues = ref<Record<string, string>>({
  role: '',
  auth_type: ''
})

// Navigation function for viewing user details
const handleViewUser = (userId: string) => {
  router.push(`/admin/users/${userId}`)
}

// Check if text search is active
const hasTextSearch = () => {
  return !!searchQuery.value && searchQuery.value.trim().length > 0
}

// Fetch users using search API (when query exists)
const searchUsers = async (): Promise<void> => {
  try {
    isLoading.value = true
    error.value = null

    const offset = (currentPage.value - 1) * pageSize.value

    const searchParams: UserSearchParams = {
      limit: pageSize.value,
      offset
    }

    // Add text search query based on selected search type
    const query = searchQuery.value.trim()
    if (query) {
      if (searchType.value === 'username') {
        searchParams.username = query
      } else if (searchType.value === 'email') {
        searchParams.email = query
      }
    }

    // Add auth type filter
    if (filterValues.value.auth_type) {
      searchParams.auth_type = filterValues.value.auth_type as 'email' | 'github'
    }

    // Add role filter
    if (filterValues.value.role) {
      searchParams.role_id = filterValues.value.role
    }

    const response = await UserService.searchUsers(searchParams)

    users.value = response.users
    pagination.value = response.pagination
    totalItems.value = response.pagination.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error'
    users.value = []
    totalItems.value = 0
  } finally {
    isLoading.value = false
  }
}

// Fetch users using list API (when no search)
const fetchUsers = async (): Promise<void> => {
  try {
    isLoading.value = true
    error.value = null

    const offset = (currentPage.value - 1) * pageSize.value

    const response = await UserService.getUsersPaginated({
      limit: pageSize.value,
      offset
    })

    // Note: Backend doesn't support filtering, so we get all users
    // and display them. Filters only work with search API.
    users.value = response.users
    pagination.value = response.pagination
    totalItems.value = response.pagination.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error'
    users.value = []
    totalItems.value = 0
  } finally {
    isLoading.value = false
  }
}

// Helper to check if any filters are active
const hasActiveFilters = () => {
  return !!(filterValues.value.auth_type || filterValues.value.role)
}

const executeSearch = async () => {
  isSearching.value = true
  currentPage.value = 1

  try {
    // Use search API when filters are active OR text search exists
    if (hasTextSearch() || hasActiveFilters()) {
      await searchUsers()
    } else {
      await fetchUsers()
    }
  } finally {
    isSearching.value = false
  }
}

// Filter change from child component
const handleFilterChange = async () => {
  await executeSearch()
}

// Pagination handlers
const handlePageChange = async (page: number) => {
  currentPage.value = page
  if (hasTextSearch() || hasActiveFilters()) {
    await searchUsers()
  } else {
    await fetchUsers()
  }
}

const handlePageSizeChange = async (newPageSize: number) => {
  pageSize.value = newPageSize
  currentPage.value = 1
  if (hasTextSearch() || hasActiveFilters()) {
    await searchUsers()
  } else {
    await fetchUsers()
  }
}

// Visible filters change
const handleVisibleFiltersChange = (filters: Set<string>) => {
  visibleFilters.value = filters
}

const handleFilterValuesChange = (values: Record<string, string>) => {
  filterValues.value = values
}

// Load users on component mount
onMounted(async () => {
  setBreadcrumbs([{ label: t('adminUsers.title') }])
  await fetchUsers()
})
</script>

<template>
  <NavbarLayout>
    <DsPageHeading :title="t('adminUsers.title')" />

    <div class="space-y-6 mt-6">
      <!-- Error State -->
      <div v-if="error" class="text-red-500">
        {{ t('adminUsers.table.error', { error }) }}
      </div>

      <!-- Users Table Component -->
      <div v-else class="space-y-4">
        <UserTableColumns
          :is-loading="isLoading"
          :users="users"
          :search-query="searchQuery"
          :is-searching="isSearching"
          :visible-filters="visibleFilters"
          :filter-values="filterValues"
          :on-view-user="handleViewUser"
          @update:search-query="(value: string) => searchQuery = value"
          @update:search-type="(value: 'username' | 'email') => searchType = value"
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
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
        />
      </div>
    </div>
  </NavbarLayout>
</template>
