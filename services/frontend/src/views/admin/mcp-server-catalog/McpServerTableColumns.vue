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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { DsTabs } from '@/components/ui/ds-tabs'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  Trash2
} from 'lucide-vue-next'
import McpServerStatusDialog from '@/components/mcp-server/McpServerStatusDialog.vue'
import McpServerDeleteDialog from '@/components/mcp-server/McpServerDeleteDialog.vue'
import CategoryDisplay from '@/components/mcp-server/CategoryDisplay.vue'
import type { McpServer } from './types'

interface Props {
  servers: McpServer[]
  selectedSource: 'all' | 'official_registry' | 'manual'
  onEditServer: (serverId: string) => void
  onToggleStatus: (serverId: string, newStatus: 'active' | 'disabled') => void
  onDeleteServer: (serverId: string) => Promise<void>
}

interface Emits {
  (e: 'selection-change', selectedIds: string[]): void
  (e: 'bulk-delete', selectedIds: string[]): Promise<void>
  (e: 'source-change', source: 'all' | 'official_registry' | 'manual'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const router = useRouter()
const { t } = useI18n()

// Source filter tabs
const sourceTabs = computed(() => [
  { value: 'all', label: t('mcpCatalog.filters.source.all') },
  { value: 'official_registry', label: t('mcpCatalog.filters.source.official_registry') },
  { value: 'manual', label: t('mcpCatalog.filters.source.manual') }
])

const handleSourceChange = (source: string) => {
  emit('source-change', source as 'all' | 'official_registry' | 'manual')
}

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

// Clear selection when servers change (e.g., page change, filter)
watch(() => props.servers, () => {
  selectedIds.value = new Set()
  emit('selection-change', [])
})

// Clear selection when source filter changes
watch(() => props.selectedSource, () => {
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

// State for bulk delete dialog
const bulkDeleteDialogOpen = ref(false)
const isBulkDeleting = ref(false)

// Computed for selected count
const selectedCount = computed(() => selectedIds.value.size)

// Handle bulk delete button click
const handleBulkDeleteClick = () => {
  if (selectedIds.value.size > 0) {
    bulkDeleteDialogOpen.value = true
  }
}

// Handle bulk delete confirmation
const handleBulkDeleteConfirm = async () => {
  if (selectedIds.value.size === 0) return

  isBulkDeleting.value = true
  try {
    await emit('bulk-delete', Array.from(selectedIds.value))
    bulkDeleteDialogOpen.value = false
    selectedIds.value = new Set()
  } finally {
    isBulkDeleting.value = false
  }
}

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
</script>

<template>
  <div class="space-y-2">
    <!-- Source filter tabs -->
    <DsTabs
      :model-value="selectedSource"
      :tabs="sourceTabs"
      variant="underlined"
      size="sm"
      @update:model-value="handleSourceChange"
    />

    <!-- Bulk actions toolbar -->
    <div class="flex items-center justify-end my-5">
      <Button
        variant="outline"
        size="sm"
        :disabled="selectedCount === 0"
        @click="handleBulkDeleteClick"
        class="flex items-center gap-2"
      >
        <Trash2 class="h-4 w-4" />
        {{ t('mcpCatalog.bulkDelete.button') }}
      </Button>
    </div>

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
          <TableHead>{{ t('mcpCatalog.table.columns.runtime') }}</TableHead>
          <TableHead>{{ t('mcpCatalog.table.columns.status') }}</TableHead>
          <TableHead class="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <!-- Empty State -->
        <TableRow v-if="props.servers.length === 0">
          <TableCell :colspan="6" class="h-24 text-center">
            {{ t('mcpCatalog.table.noData') }}
          </TableCell>
        </TableRow>

        <!-- Data Rows -->
        <TableRow v-for="server in props.servers" :key="server.id">
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
              <div>{{ server.name }}</div>
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
            <CategoryDisplay :category-id="server.category_id" />
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

  <!-- Bulk Delete Confirmation Dialog -->
  <AlertDialog :open="bulkDeleteDialogOpen" @update:open="(value) => bulkDeleteDialogOpen = value">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {{ t('mcpCatalog.bulkDelete.dialogTitle') }}
        </AlertDialogTitle>
        <AlertDialogDescription class="space-y-3">
          <p>{{ t('mcpCatalog.bulkDelete.dialogDescription', { count: selectedCount }) }}</p>
          <div class="bg-red-50 dark:bg-red-950 p-3 rounded-md">
            <p class="text-sm text-red-800 dark:text-red-200">
              {{ t('mcpCatalog.bulkDelete.dialogWarning') }}
            </p>
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="isBulkDeleting">
          {{ t('mcpCatalog.bulkDelete.cancel') }}
        </AlertDialogCancel>
        <AlertDialogAction
          @click="handleBulkDeleteConfirm"
          :disabled="isBulkDeleting"
          class="bg-red-600 hover:bg-red-700 flex items-center gap-2"
        >
          <Trash2 class="h-4 w-4" />
          {{ isBulkDeleting ? t('mcpCatalog.bulkDelete.deleting') : t('mcpCatalog.bulkDelete.confirm') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

