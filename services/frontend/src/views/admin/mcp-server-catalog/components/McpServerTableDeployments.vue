<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  MoreVertical,
  Github,
  GitBranch,
  Globe,
  ExternalLink,
  CircleCheck,
  Circle,
  CircleAlert,
  CircleMinus,
} from 'lucide-vue-next'
import McpServerStatusDialog from '@/components/mcp-server/McpServerStatusDialog.vue'
import McpServerDeleteDialog from '@/components/mcp-server/McpServerDeleteDialog.vue'
import CategoryDisplay from '@/components/mcp-server/CategoryDisplay.vue'
import type { McpServer, McpServerWithTeam } from '../types'

interface Props {
  servers: (McpServer | McpServerWithTeam)[]
  isLoading: boolean
  onEditServer: (serverId: string) => void
  onToggleStatus: (serverId: string, newStatus: 'active' | 'disabled') => void
  onDeleteServer: (serverId: string) => Promise<void>
}

interface Emits {
  (e: 'selection-change', selectedIds: string[]): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const router = useRouter()
const { t } = useI18n()

// Selection state
const selectedIds = ref<Set<string>>(new Set())

// Computed properties for selection
const isAllSelected = computed(() => {
  return props.servers.length > 0 && selectedIds.value.size === props.servers.length
})

// Toggle all rows selection
const toggleAllRows = (checked: boolean) => {
  if (checked) {
    selectedIds.value = new Set(props.servers.map(s => s.id))
  } else {
    selectedIds.value = new Set()
  }
  emit('selection-change', Array.from(selectedIds.value))
}

// Toggle single row selection
const toggleRow = (serverId: string, checked: boolean) => {
  const newSelection = new Set(selectedIds.value)
  if (checked) {
    newSelection.add(serverId)
  } else {
    newSelection.delete(serverId)
  }
  selectedIds.value = newSelection
  emit('selection-change', Array.from(selectedIds.value))
}

// Check if a row is selected
const isRowSelected = (serverId: string) => {
  return selectedIds.value.has(serverId)
}

// Clear selection when servers change
watch(() => props.servers, () => {
  selectedIds.value = new Set()
  emit('selection-change', [])
})

// State for status dialog
const statusDialogOpen = ref(false)
const serverToToggle = ref<McpServer | null>(null)

// State for delete dialog
const deleteDialogOpen = ref(false)
const serverToDelete = ref<McpServer | null>(null)
const isDeleting = ref(false)

// Handle status toggle - open dialog
const handleStatusClick = (server: McpServer) => {
  serverToToggle.value = server
  statusDialogOpen.value = true
}

// Handle status confirmation from dialog
const handleStatusConfirm = (serverId: string, newStatus: 'active' | 'disabled') => {
  props.onToggleStatus(serverId, newStatus)
  serverToToggle.value = null
}

// Handle delete click - open dialog
const handleDeleteClick = (server: McpServer) => {
  serverToDelete.value = server
  deleteDialogOpen.value = true
}

// Handle delete confirmation from dialog
const handleDeleteConfirm = async () => {
  if (serverToDelete.value) {
    isDeleting.value = true
    try {
      await props.onDeleteServer(serverToDelete.value.id)
      deleteDialogOpen.value = false
      serverToDelete.value = null
    } finally {
      isDeleting.value = false
    }
  }
}

// Navigate to edit page
const handleEditServer = (serverId: string) => {
  router.push(`/admin/mcp-server-catalog/edit/${serverId}`)
}

// Navigate to install page
const handleInstallServer = (serverId: string) => {
  router.push(`/mcp-server/install/${serverId}`)
}

// Get repository icon based on platform
const getRepositoryIcon = (platform?: string) => {
  switch (platform) {
    case 'github':
      return Github
    case 'gitlab':
    case 'bitbucket':
      return GitBranch
    default:
      return Globe
  }
}

// Get repository label based on platform
const getRepositoryLabel = (platform?: string) => {
  switch (platform) {
    case 'github':
      return 'Repository'
    case 'gitlab':
      return 'GitLab'
    case 'bitbucket':
      return 'Bitbucket'
    default:
      return 'Repository'
  }
}

// Helper to get team name from server
const getTeamName = (server: McpServer | McpServerWithTeam): string => {
  if ('team_name' in server && server.team_name) {
    return server.team_name
  }
  return 'Unknown Team'
}

// Helper to get team link
const getTeamLink = (server: McpServer | McpServerWithTeam): string | null => {
  if ('team_slug' in server && server.team_slug && server.team_id) {
    return `/admin/teams/${server.team_id}/general`
  }
  return null
}
</script>

<template>
  <div class="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-[50px]">
            <Checkbox
              :checked="isAllSelected"
              @update:checked="toggleAllRows"
              aria-label="Select all"
            />
          </TableHead>
          <TableHead>{{ t('mcpCatalog.table.columns.name') }}</TableHead>
          <TableHead>{{ t('mcpCatalog.table.columns.category') }}</TableHead>
          <TableHead>{{ t('mcpCatalog.table.columns.team') }}</TableHead>
          <TableHead>{{ t('mcpCatalog.table.columns.runtime') }}</TableHead>
          <TableHead>{{ t('mcpCatalog.table.columns.status') }}</TableHead>
          <TableHead class="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <!-- Loading State - Skeleton Rows -->
        <template v-if="props.isLoading">
          <TableRow v-for="i in 5" :key="`skeleton-${i}`">
            <TableCell>
              <Skeleton class="h-4 w-4" />
            </TableCell>
            <TableCell>
              <div class="space-y-2">
                <Skeleton class="h-4 w-[180px]" />
                <Skeleton class="h-3 w-[120px]" />
              </div>
            </TableCell>
            <TableCell>
              <Skeleton class="h-5 w-[100px] rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton class="h-5 w-[90px] rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton class="h-5 w-[60px] rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton class="h-5 w-[70px] rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton class="h-8 w-8 rounded" />
            </TableCell>
          </TableRow>
        </template>

        <!-- Empty State -->
        <TableRow v-else-if="props.servers.length === 0">
          <TableCell :colspan="7" class="h-24 text-center">
            {{ t('mcpCatalog.table.noData') }}
          </TableCell>
        </TableRow>

        <!-- Data Rows -->
        <TableRow v-else v-for="server in props.servers" :key="server.id">
          <!-- Checkbox -->
          <TableCell>
            <Checkbox
              :checked="isRowSelected(server.id)"
              @update:checked="(checked: boolean) => toggleRow(server.id, checked)"
              aria-label="Select row"
            />
          </TableCell>

          <!-- Name -->
          <TableCell>
            <div class="space-y-1">
              <RouterLink :to="`/admin/mcp-server-catalog/view/${server.id}`" class="link">
                {{ server.name }}
              </RouterLink>
              <!-- Repository Link -->
              <div v-if="server.repository_url" class="flex items-center gap-1">
                <component
                  :is="getRepositoryIcon(server.repository_source)"
                  class="h-3 w-3 text-muted-foreground"
                />
                <a
                  :href="server.repository_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs text-blue-600 hover:underline"
                >
                  {{ getRepositoryLabel(server.repository_source) }}
                  <ExternalLink class="inline h-3 w-3 ml-1" />
                </a>
              </div>
            </div>
          </TableCell>

          <!-- Category -->
          <TableCell>
            <CategoryDisplay :category="server.category" />
          </TableCell>

          <!-- Team Column (NEW) -->
          <TableCell>
            <RouterLink
              v-if="getTeamLink(server)"
              :to="getTeamLink(server)!"
              class="link"
            >
              {{ getTeamName(server) }}
            </RouterLink>
            <span v-else class="text-muted-foreground">
              {{ getTeamName(server) }}
            </span>
          </TableCell>

          <!-- Runtime -->
          <TableCell>
            <div class="inline-flex items-center justify-center rounded-full border px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
              {{ server.runtime }}
            </div>
          </TableCell>

          <!-- Status -->
          <TableCell>
            <div
              class="inline-flex items-center justify-center rounded-full border px-1.5 py-0.5 text-xs font-medium text-muted-foreground gap-1"
            >
              <CircleCheck
                v-if="server.status === 'active'"
                class="size-3 fill-green-500 text-green-500 dark:fill-green-400 dark:text-green-400"
              />
              <CircleMinus
                v-else-if="server.status === 'disabled'"
                class="size-3 text-muted-foreground"
              />
              <CircleAlert
                v-else-if="server.status === 'maintenance'"
                class="size-3 fill-yellow-500 text-yellow-500 dark:fill-yellow-400 dark:text-yellow-400"
              />
              <Circle
                v-else
                class="size-3 text-muted-foreground"
              />
              <span>{{ t(`mcpCatalog.status.${server.status}`) }}</span>
            </div>
          </TableCell>

          <!-- Actions -->
          <TableCell>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" class="h-8 w-8 p-0">
                  <span class="sr-only">{{ t('mcpCatalog.table.openMenu') }}</span>
                  <MoreVertical class="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem @click="props.onEditServer(server.id)">
                  {{ t('mcpCatalog.table.actions.view') }}
                </DropdownMenuItem>
                <DropdownMenuItem @click="handleEditServer(server.id)">
                  {{ t('mcpCatalog.table.actions.edit') }}
                </DropdownMenuItem>
                <DropdownMenuItem @click="handleInstallServer(server.id)">
                  {{ t('mcpCatalog.table.actions.install') }}
                </DropdownMenuItem>
                <DropdownMenuItem @click="handleStatusClick(server)">
                  {{ server.status === 'disabled' ? t('mcpCatalog.table.actions.enable') : t('mcpCatalog.table.actions.disable') }}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem @click="handleDeleteClick(server)" class="text-red-600 focus:text-red-600">
                  {{ t('mcpCatalog.table.actions.delete') }}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>

  <!-- Status Change Confirmation Dialog -->
  <McpServerStatusDialog
    v-model:open="statusDialogOpen"
    :server="serverToToggle"
    @confirm="handleStatusConfirm"
  />

  <!-- Delete Confirmation Dialog -->
  <McpServerDeleteDialog
    v-model:open="deleteDialogOpen"
    :server-name="serverToDelete?.name || ''"
    :is-deleting="isDeleting"
    @confirm="handleDeleteConfirm"
  />
</template>
