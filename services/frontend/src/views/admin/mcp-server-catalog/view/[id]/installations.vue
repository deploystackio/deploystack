<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ButtonGroup } from '@/components/ui/button-group'
import { Spinner } from '@/components/ui/spinner'
import PaginationControls from '@/components/ui/pagination/PaginationControls.vue'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { McpServerCatalogDetailHeader, McpServerCatalogDetailTabs } from '@/components/admin/mcp-server-catalog'
import { useMcpCatalogServerCache } from '@/composables/admin/mcp-catalog'
import { McpCatalogService, type TeamWithInstallations } from '@/services/mcpCatalogService'
import { Users, Search } from 'lucide-vue-next'

const {
  server,
  isLoading: isLoadingServer,
  serverId,
  loadAndSetServer,
  initializeCache,
  setupWatchers,
  cleanupWatchers
} = useMcpCatalogServerCache()

const teams = ref<TeamWithInstallations[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

// Pagination state
const currentPage = ref(1)
const pageSize = ref(20)
const totalItems = ref(0)

// Search state
const searchQuery = ref('')
const searchType = ref<'name' | 'slug'>('name')
const isSearching = ref(false)

// Fetch teams with pagination
async function fetchTeams() {
  isLoading.value = true
  error.value = null

  try {
    const offset = (currentPage.value - 1) * pageSize.value
    const response = await McpCatalogService.getTeamsByServer(serverId, {
      limit: pageSize.value,
      offset
    })

    teams.value = response.teams
    totalItems.value = response.pagination.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to fetch teams'
    teams.value = []
  } finally {
    isLoading.value = false
  }
}

// Search teams with query
async function searchTeams() {
  if (!searchQuery.value.trim()) {
    await fetchTeams()
    return
  }

  isSearching.value = true
  error.value = null

  try {
    const offset = (currentPage.value - 1) * pageSize.value
    const response = await McpCatalogService.searchTeamsByServer(serverId, {
      name: searchQuery.value.trim(),
      limit: pageSize.value,
      offset
    })

    teams.value = response.teams
    totalItems.value = response.pagination.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to search teams'
    teams.value = []
  } finally {
    isSearching.value = false
  }
}

// Execute search on Enter key
async function executeSearch() {
  currentPage.value = 1
  await searchTeams()
}

// Handle page change
async function handlePageChange(page: number) {
  currentPage.value = page
  if (searchQuery.value.trim()) {
    await searchTeams()
  } else {
    await fetchTeams()
  }
}

// Handle page size change
async function handlePageSizeChange(newPageSize: number) {
  pageSize.value = newPageSize
  currentPage.value = 1
  if (searchQuery.value.trim()) {
    await searchTeams()
  } else {
    await fetchTeams()
  }
}

// Get status badge variant
function getStatusBadgeVariant(count: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (count === 0) return 'outline'
  return 'default'
}

// Format date
function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleDateString()
}

// Truncate team name if longer than 20 characters
function truncateTeamName(name: string): string {
  if (name.length > 20) {
    return name.substring(0, 20) + '...'
  }
  return name
}

// Watch for search query changes - reset to list when cleared
watch(searchQuery, (newValue, oldValue) => {
  // If search was cleared (had value, now empty) and there are no teams
  if (oldValue && !newValue.trim() && teams.value.length === 0) {
    fetchTeams()
  }
})

onMounted(async () => {
  initializeCache()
  await loadAndSetServer()
  setupWatchers()
  await fetchTeams()
})

onUnmounted(() => {
  cleanupWatchers()
})
</script>

<template>
  <NavbarLayout>
    <McpServerCatalogDetailHeader :server="server" :is-loading="isLoadingServer" :server-id="serverId" />

    <div class="space-y-6 mt-6">
      <!-- Tabs - Always visible when server is loaded -->
      <McpServerCatalogDetailTabs v-if="server" :server="server" :server-id="serverId">
        <!-- Loading State -->
        <div v-if="isLoading" class="space-y-4">
          <Skeleton class="h-12 w-full" />
          <Skeleton class="h-12 w-full" />
          <Skeleton class="h-12 w-full" />
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="text-red-500">
          {{ error }}
        </div>

        <!-- Empty State (only when no search query and no teams) -->
        <Empty v-else-if="teams.length === 0 && !searchQuery.trim()">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
          </EmptyHeader>
          <EmptyTitle>No teams found</EmptyTitle>
          <EmptyDescription>
            This MCP server has not been installed by any teams yet.
          </EmptyDescription>
        </Empty>

        <!-- Teams Table or Search Results -->
        <div v-else class="space-y-4">
          <!-- Search Input with Type Selector -->
          <ButtonGroup class="w-96 mb-5">
            <Select v-model="searchType">
              <SelectTrigger class="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Team Name</SelectItem>
                <SelectItem value="slug">Team Slug</SelectItem>
              </SelectContent>
            </Select>
            <div class="relative flex-1">
              <Input
                v-model="searchQuery"
                :placeholder="isSearching ? 'Searching...' : 'Search teams...'"
                :disabled="isSearching"
                @keyup.enter="executeSearch"
                class="rounded-l-none border-l-0 pr-9"
              />
              <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <Spinner v-if="isSearching" class="h-4 w-4" />
                <Search v-else class="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </ButtonGroup>

          <!-- Data Table -->
          <div class="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Installations</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Last Used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <!-- Empty search results -->
                <TableRow v-if="teams.length === 0">
                  <TableCell :colspan="5" class="h-24 text-center">
                    No teams found matching "{{ searchQuery }}"
                  </TableCell>
                </TableRow>

                <!-- Data Rows -->
                <TableRow v-for="team in teams" :key="team.team_id">
                  <!-- Team -->
                  <TableCell>
                    <a
                      :href="`/admin/teams/${team.team_id}/general`"
                      class="link font-medium"
                    >
                      {{ truncateTeamName(team.team_name) }} ({{ team.team_slug }})
                    </a>
                  </TableCell>

                  <!-- Installation Count -->
                  <TableCell>
                    {{ team.installation_count }}
                  </TableCell>

                  <!-- Status Summary -->
                  <TableCell>
                    <div class="flex flex-wrap gap-1">
                      <Badge
                        v-if="team.status_summary.online > 0"
                        :variant="getStatusBadgeVariant(team.status_summary.online)"
                        class="bg-green-50 text-green-700 border-green-200"
                      >
                        {{ team.status_summary.online }} online
                      </Badge>
                      <Badge
                        v-if="team.status_summary.offline > 0"
                        :variant="getStatusBadgeVariant(team.status_summary.offline)"
                        class="bg-neutral-50 text-neutral-700 border-neutral-200"
                      >
                        {{ team.status_summary.offline }} offline
                      </Badge>
                      <Badge
                        v-if="team.status_summary.error > 0"
                        variant="destructive"
                      >
                        {{ team.status_summary.error }} error
                      </Badge>
                      <Badge
                        v-if="team.status_summary.provisioning > 0"
                        class="bg-yellow-50 text-yellow-700 border-yellow-200"
                      >
                        {{ team.status_summary.provisioning }} provisioning
                      </Badge>
                    </div>
                  </TableCell>

                  <!-- Created At -->
                  <TableCell>
                    <div class="text-sm">
                      {{ formatDate(team.installations[0]?.created_at) }}
                    </div>
                  </TableCell>

                  <!-- Last Used -->
                  <TableCell>
                    <div class="text-sm">
                      {{ formatDate(team.installations[0]?.last_used_at) }}
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <!-- Pagination -->
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
      </McpServerCatalogDetailTabs>
    </div>
  </NavbarLayout>
</template>
