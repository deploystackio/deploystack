<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { Search } from 'lucide-vue-next'
import { DsPageHeading } from '@/components/ui/ds-page-heading'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { TeamService } from '@/services/teamService'
import TeamTableColumns from './TeamTableColumns.vue'
import PaginationControls from '@/components/ui/pagination/PaginationControls.vue'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Team, PaginationMeta } from './types'

const { t } = useI18n()
const router = useRouter()
const { setBreadcrumbs } = useBreadcrumbs()

const teams = ref<Team[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')

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

// Navigation function for viewing team details
const handleViewTeam = (teamId: string) => {
  router.push(`/admin/teams/${teamId}`)
}

// Check if text search is active
const hasTextSearch = () => {
  return !!searchQuery.value && searchQuery.value.trim().length > 0
}

// Search via backend API
const searchTeams = async (): Promise<void> => {
  try {
    isLoading.value = true
    error.value = null
    const offset = (currentPage.value - 1) * pageSize.value

    const response = await TeamService.searchTeamsAdmin({
      name: searchQuery.value.trim(),
      limit: pageSize.value,
      offset
    })

    teams.value = response.teams
    pagination.value = response.pagination
    totalItems.value = response.pagination.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    teams.value = []
    totalItems.value = 0
  } finally {
    isLoading.value = false
  }
}

// Fetch all teams with pagination
const fetchTeams = async (): Promise<void> => {
  try {
    isLoading.value = true
    error.value = null
    const offset = (currentPage.value - 1) * pageSize.value

    const response = await TeamService.getTeamsAdminPaginated({
      limit: pageSize.value,
      offset
    })

    teams.value = response.teams
    pagination.value = response.pagination
    totalItems.value = response.pagination.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    teams.value = []
    totalItems.value = 0
  } finally {
    isLoading.value = false
  }
}

// Execute search or fetch
const executeSearch = async () => {
  currentPage.value = 1
  if (hasTextSearch()) {
    await searchTeams()
  } else {
    await fetchTeams()
  }
}

// Pagination handlers
const handlePageChange = async (page: number) => {
  currentPage.value = page
  if (hasTextSearch()) {
    await searchTeams()
  } else {
    await fetchTeams()
  }
}

const handlePageSizeChange = async (newPageSize: number) => {
  pageSize.value = newPageSize
  currentPage.value = 1
  if (hasTextSearch()) {
    await searchTeams()
  } else {
    await fetchTeams()
  }
}

// Load teams on component mount
onMounted(async () => {
  setBreadcrumbs([{ label: t('adminTeams.title') }])
  await fetchTeams()
})
</script>

<template>
  <NavbarLayout>
    <DsPageHeading :title="t('adminTeams.title')" />

    <div class="space-y-6">
      <!-- Error State -->
      <div v-if="error" class="text-red-500">
        {{ t('adminTeams.table.error', { error }) }}
      </div>

      <!-- Data Table with Search -->
      <div v-else class="space-y-4">
        <!-- Search Input -->
        <div class="flex items-center py-4">
          <div class="flex items-center rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] has-[input:disabled]:opacity-50 has-[input:disabled]:cursor-not-allowed max-w-sm">
            <input
              type="text"
              :placeholder="t('adminTeams.table.search.placeholder')"
              v-model="searchQuery"
              @keyup.enter="executeSearch"
              class="flex-1 h-9 min-w-0 bg-transparent px-3 py-1 text-base outline-none placeholder:text-muted-foreground md:text-sm disabled:pointer-events-none disabled:cursor-not-allowed"
            />
            <div class="flex items-center justify-center text-muted-foreground order-last pr-3">
              <Search class="h-4 w-4" />
            </div>
          </div>
        </div>

        <!-- Loading State with Skeleton -->
        <div v-if="isLoading" class="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('adminTeams.table.columns.name') }}</TableHead>
                <TableHead>{{ t('adminTeams.table.columns.mcpServers') }}</TableHead>
                <TableHead>{{ t('adminTeams.table.columns.members') }}</TableHead>
                <TableHead>{{ t('adminTeams.table.columns.type') }}</TableHead>
                <TableHead>{{ t('adminTeams.table.columns.createdAt') }}</TableHead>
                <TableHead class="w-[100px]">{{ t('adminTeams.table.columns.actions') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="i in 5" :key="i">
                <TableCell><Skeleton class="h-4 w-32" /></TableCell>
                <TableCell><Skeleton class="h-4 w-8" /></TableCell>
                <TableCell><Skeleton class="h-4 w-8" /></TableCell>
                <TableCell><Skeleton class="h-5 w-16" /></TableCell>
                <TableCell><Skeleton class="h-4 w-20" /></TableCell>
                <TableCell><Skeleton class="h-8 w-16" /></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <!-- Teams Table Component -->
        <TeamTableColumns
          v-else
          :teams="teams"
          :on-view-team="handleViewTeam"
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
