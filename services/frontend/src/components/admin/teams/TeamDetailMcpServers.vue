<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import PaginationControls from '@/components/ui/pagination/PaginationControls.vue'
import { Package, CircleCheck, CircleMinus, CircleAlert, Circle } from 'lucide-vue-next'
import { getEnv } from '@/utils/env'

interface StatusSummary {
  total_instances: number
  online: number
  offline: number
  error: number
  provisioning: number
}

interface McpInstallation {
  installation_id: string
  server_id: string
  installation_name: string
  server_name: string
  server_slug: string
  status_summary: StatusSummary
  created_at: string
  last_used_at: string | null
}

interface PaginationMetadata {
  total: number
  limit: number
  offset: number
  has_more: boolean
}

interface McpInstallationsResponse {
  success: boolean
  data: {
    installations: McpInstallation[]
    pagination: PaginationMetadata
  }
}

const props = defineProps<{
  teamId: string
}>()

const { t } = useI18n()
const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL') || ''

const installations = ref<McpInstallation[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

// Pagination state
const currentPage = ref(1)
const pageSize = ref(20)
const totalItems = ref(0)

// Fetch MCP installations from API
async function fetchMcpInstallations(): Promise<McpInstallationsResponse> {
  if (!apiUrl) {
    throw new Error('VITE_DEPLOYSTACK_BACKEND_URL is not configured.')
  }

  const offset = (currentPage.value - 1) * pageSize.value
  const url = `${apiUrl}/api/admin/teams/${props.teamId}/mcp/installations?limit=${pageSize.value}&offset=${offset}`

  const response = await fetch(url, {
    credentials: 'include'
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to fetch MCP installations: ${response.statusText} (status: ${response.status})`)
  }

  return await response.json()
}

// Load installations
async function loadInstallations() {
  try {
    isLoading.value = true
    const response = await fetchMcpInstallations()
    installations.value = response.data.installations
    totalItems.value = response.data.pagination.total
    error.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load MCP installations'
    installations.value = []
    totalItems.value = 0
  } finally {
    isLoading.value = false
  }
}

// Pagination handlers
const handlePageChange = async (page: number) => {
  currentPage.value = page
  await loadInstallations()
}

const handlePageSizeChange = async (newPageSize: number) => {
  pageSize.value = newPageSize
  currentPage.value = 1
  await loadInstallations()
}

// Format date for display
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}

onMounted(async () => {
  await loadInstallations()
})
</script>

<template>
  <div class="space-y-6">
    <p class="text-sm text-muted-foreground">
      MCP server installations configured for this team.
    </p>

    <!-- Error State -->
    <div v-if="error" class="text-red-500">
      {{ t('adminTeams.mcpServers.errorLoading', { error }) }}
    </div>

    <!-- Loading State with Skeleton -->
    <div v-else-if="isLoading" class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{ t('adminTeams.mcpServers.table.serverName') }}</TableHead>
            <TableHead>{{ t('adminTeams.mcpServers.table.status') }}</TableHead>
            <TableHead>{{ t('adminTeams.mcpServers.table.createdAt') }}</TableHead>
            <TableHead>{{ t('adminTeams.mcpServers.table.lastUsedAt') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="i in 5" :key="i">
            <TableCell><Skeleton class="h-4 w-24" /></TableCell>
            <TableCell><Skeleton class="h-5 w-16" /></TableCell>
            <TableCell><Skeleton class="h-4 w-20" /></TableCell>
            <TableCell><Skeleton class="h-4 w-20" /></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Empty State -->
    <Empty v-else-if="installations.length === 0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Package />
        </EmptyMedia>
      </EmptyHeader>
      <EmptyTitle>{{ t('adminTeams.mcpServers.noInstallations') }}</EmptyTitle>
      <EmptyDescription>
        This team has not installed any MCP servers yet.
      </EmptyDescription>
    </Empty>

    <!-- Data Table -->
    <div v-else class="space-y-4">
      <div class="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{{ t('adminTeams.mcpServers.table.serverName') }}</TableHead>
              <TableHead>{{ t('adminTeams.mcpServers.table.status') }}</TableHead>
              <TableHead>{{ t('adminTeams.mcpServers.table.createdAt') }}</TableHead>
              <TableHead>{{ t('adminTeams.mcpServers.table.lastUsedAt') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="installation in installations"
              :key="installation.installation_id"
            >
              <TableCell class="font-medium">
                <router-link
                  :to="`/admin/mcp-server-catalog/view/${installation.server_id}`"
                  class="text-primary hover:underline"
                >
                  {{ installation.server_name }}
                </router-link>
              </TableCell>
              <TableCell>
                <div v-if="installation.status_summary.total_instances === 0" class="text-muted-foreground text-xs">
                  No instances
                </div>
                <div v-else class="flex flex-col gap-1">
                  <!-- Show online count if > 0 -->
                  <div v-if="installation.status_summary.online > 0" class="inline-flex items-center gap-1 text-xs">
                    <CircleCheck class="size-3 fill-green-500 text-green-500 dark:fill-green-400 dark:text-green-400" />
                    <span>{{ installation.status_summary.online }} online</span>
                  </div>
                  <!-- Show offline count if > 0 -->
                  <div v-if="installation.status_summary.offline > 0" class="inline-flex items-center gap-1 text-xs">
                    <CircleMinus class="size-3 text-muted-foreground" />
                    <span>{{ installation.status_summary.offline }} offline</span>
                  </div>
                  <!-- Show error count if > 0 -->
                  <div v-if="installation.status_summary.error > 0" class="inline-flex items-center gap-1 text-xs">
                    <CircleAlert class="size-3 fill-red-500 text-red-500 dark:fill-red-400 dark:text-red-400" />
                    <span>{{ installation.status_summary.error }} error</span>
                  </div>
                  <!-- Show provisioning count if > 0 -->
                  <div v-if="installation.status_summary.provisioning > 0" class="inline-flex items-center gap-1 text-xs">
                    <Circle class="size-3 fill-blue-500 text-blue-500 dark:fill-blue-400 dark:text-blue-400" />
                    <span>{{ installation.status_summary.provisioning }} provisioning</span>
                  </div>
                </div>
              </TableCell>
              <TableCell>{{ formatDate(installation.created_at) }}</TableCell>
              <TableCell>
                {{ installation.last_used_at ? formatDate(installation.last_used_at) : t('adminTeams.mcpServers.table.never') }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

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
</template>
