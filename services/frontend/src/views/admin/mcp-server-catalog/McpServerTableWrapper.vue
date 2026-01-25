<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DsTabs } from '@/components/ui/ds-tabs'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Search, SlidersHorizontal, Trash2, X } from 'lucide-vue-next'
import { Spinner } from '@/components/ui/spinner'
import {
  McpServerTableAll,
  McpServerTableOfficialRegistry,
  McpServerTableManual,
  McpServerTableDeployments,
} from './components'
import type { McpServer } from './types'

interface Props {
  servers: McpServer[]
  selectedSource: 'all' | 'official_registry' | 'manual' | 'deployments'
  searchQuery: string
  isSearching: boolean
  isLoading: boolean
  visibleFilters: Set<string>
  filterValues: Record<string, string>
  onEditServer: (serverId: string) => void
  onToggleStatus: (serverId: string, newStatus: 'active' | 'disabled') => void
  onDeleteServer: (serverId: string) => Promise<void>
}

interface Emits {
  (e: 'selection-change', selectedIds: string[]): void
  (e: 'bulk-delete', selectedIds: string[]): Promise<void>
  (e: 'source-change', source: 'all' | 'official_registry' | 'manual' | 'deployments'): void
  (e: 'update:searchQuery', value: string): void
  (e: 'search'): void
  (e: 'filter-change', filters: Record<string, string>): void
  (e: 'visible-filters-change', filters: Set<string>): void
  (e: 'filter-values-change', values: Record<string, string>): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

// Source filter tabs
const sourceTabs = computed(() => [
  { value: 'all', label: t('mcpCatalog.filters.source.all') },
  { value: 'official_registry', label: t('mcpCatalog.filters.source.official_registry') },
  { value: 'manual', label: t('mcpCatalog.filters.source.manual') },
  { value: 'deployments', label: t('mcpCatalog.filters.source.deployments') }
])

const handleSourceChange = (source: string) => {
  emit('source-change', source as 'all' | 'official_registry' | 'manual' | 'deployments')
}

// Local search query (synced with parent via v-model)
const localSearchQuery = ref(props.searchQuery)

// Filter types
type FilterType = 'status' | 'language' | 'runtime' | 'featured' | 'autoInstall'

// Helper to update a single filter value
const updateFilterValue = (filter: FilterType, value: string) => {
  const newValues = { ...props.filterValues, [filter]: value }
  emit('filter-values-change', newValues)
  // Also emit filter-change for the parent to trigger search
  const active: Record<string, string> = {}
  for (const [key, val] of Object.entries(newValues)) {
    if (val) {
      active[key] = val
    }
  }
  emit('filter-change', active)
}

// Toggle filter visibility
const toggleFilter = (filter: FilterType) => {
  const newFilters = new Set(props.visibleFilters)
  if (newFilters.has(filter)) {
    newFilters.delete(filter)
  } else {
    newFilters.add(filter)
  }
  emit('visible-filters-change', newFilters)
}

// Remove filter (reset value and hide)
const removeFilter = (filter: FilterType) => {
  // Reset value and emit
  const newValues = { ...props.filterValues, [filter]: '' }
  emit('filter-values-change', newValues)
  // Hide the filter
  const newFilters = new Set(props.visibleFilters)
  newFilters.delete(filter)
  emit('visible-filters-change', newFilters)
  // Emit filter-change to trigger search
  const active: Record<string, string> = {}
  for (const [key, val] of Object.entries(newValues)) {
    if (val) {
      active[key] = val
    }
  }
  emit('filter-change', active)
}

// Check if any filters are visible
const hasVisibleFilters = computed(() => props.visibleFilters.size > 0)

// Watch for parent changes
watch(() => props.searchQuery, (newValue) => {
  localSearchQuery.value = newValue
})

// Handle search input change
const handleSearchInput = (value: string | number) => {
  localSearchQuery.value = String(value)
  emit('update:searchQuery', String(value))
}

// Handle search submit (Enter key)
const handleSearchSubmit = () => {
  emit('search')
}

// Selection state (for bulk delete)
const selectedIds = ref<string[]>([])

// Computed for selected count
const selectedCount = computed(() => selectedIds.value.length)

// Handle selection change from child tables
const handleSelectionChange = (ids: string[]) => {
  selectedIds.value = ids
  emit('selection-change', ids)
}

// Bulk delete state
const bulkDeleteDialogOpen = ref(false)
const isBulkDeleting = ref(false)

// Handle bulk delete button click
const handleBulkDeleteClick = () => {
  if (selectedIds.value.length > 0) {
    bulkDeleteDialogOpen.value = true
  }
}

// Handle bulk delete confirmation
const handleBulkDeleteConfirm = async () => {
  if (selectedIds.value.length === 0) return

  isBulkDeleting.value = true
  try {
    await emit('bulk-delete', selectedIds.value)
    bulkDeleteDialogOpen.value = false
    selectedIds.value = []
  } finally {
    isBulkDeleting.value = false
  }
}

// Compute which table component to show
const tableComponent = computed(() => {
  switch (props.selectedSource) {
    case 'all':
      return McpServerTableAll
    case 'official_registry':
      return McpServerTableOfficialRegistry
    case 'manual':
      return McpServerTableManual
    case 'deployments':
      return McpServerTableDeployments
    default:
      return McpServerTableAll
  }
})
</script>

<template>
  <div class="space-y-2">
    <!-- Source filter tabs (SHARED) -->
    <DsTabs
      :model-value="selectedSource"
      :tabs="sourceTabs"
      variant="underlined"
      size="sm"
      @update:model-value="handleSourceChange"
    />

    <!-- Search and filters toolbar (SHARED) -->
    <div class="flex items-center justify-between my-5">
      <!-- Search Input -->
      <InputGroup class="w-96" :disabled="isSearching">
        <InputGroupInput
          :model-value="localSearchQuery"
          :placeholder="isSearching ? t('mcpCatalog.table.search.searching') : t('mcpCatalog.table.search.placeholder')"
          :disabled="isSearching"
          @update:model-value="handleSearchInput"
          @keyup.enter="handleSearchSubmit"
        />
        <InputGroupAddon>
          <Spinner v-if="isSearching" />
          <Search v-else class="h-4 w-4" />
        </InputGroupAddon>
      </InputGroup>

      <!-- Filters and Bulk Delete (SHARED) -->
      <div class="flex items-center gap-2">
        <!-- Filters Dropdown -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              variant="outline"
              class="h-9 flex items-center gap-2"
            >
              <SlidersHorizontal class="h-4 w-4" />
              {{ t('mcpCatalog.filters.button') }}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @click="toggleFilter('status')">
              {{ t('mcpCatalog.filters.status.label') }}
            </DropdownMenuItem>
            <DropdownMenuItem @click="toggleFilter('language')">
              {{ t('mcpCatalog.filters.language.label') }}
            </DropdownMenuItem>
            <DropdownMenuItem @click="toggleFilter('runtime')">
              {{ t('mcpCatalog.filters.runtime.label') }}
            </DropdownMenuItem>
            <DropdownMenuItem @click="toggleFilter('featured')">
              {{ t('mcpCatalog.filters.featured.label') }}
            </DropdownMenuItem>
            <DropdownMenuItem @click="toggleFilter('autoInstall')">
              {{ t('mcpCatalog.filters.autoInstall.label') }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <!-- Bulk Delete Button -->
        <Button
          variant="outline"
          :disabled="selectedCount === 0"
          @click="handleBulkDeleteClick"
          class="h-9 flex items-center gap-2"
        >
          <Trash2 class="h-4 w-4" />
          {{ t('mcpCatalog.bulkDelete.button') }}
        </Button>
      </div>
    </div>

    <!-- Active Filters Row (SHARED) -->
    <div v-if="hasVisibleFilters" class="flex flex-wrap gap-2">
      <!-- Status Filter -->
      <div v-if="props.visibleFilters.has('status')" class="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5">
        <span class="text-sm font-medium whitespace-nowrap">{{ t('mcpCatalog.filters.status.label') }}</span>
        <Select :model-value="props.filterValues.status" @update:model-value="(v) => updateFilterValue('status', String(v ?? ''))">
          <SelectTrigger class="h-7 w-[150px]">
            <SelectValue :placeholder="t('mcpCatalog.filters.status.placeholder')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{{ t('mcpCatalog.status.active') }}</SelectItem>
            <SelectItem value="disabled">{{ t('mcpCatalog.status.disabled') }}</SelectItem>
            <SelectItem value="maintenance">{{ t('mcpCatalog.status.maintenance') }}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" class="h-6 w-6" @click="removeFilter('status')">
          <X class="h-4 w-4" />
        </Button>
      </div>

      <!-- Language Filter -->
      <div v-if="props.visibleFilters.has('language')" class="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5">
        <span class="text-sm font-medium whitespace-nowrap">{{ t('mcpCatalog.filters.language.label') }}</span>
        <Select :model-value="props.filterValues.language" @update:model-value="(v) => updateFilterValue('language', String(v ?? ''))">
          <SelectTrigger class="h-7 w-[150px]">
            <SelectValue :placeholder="t('mcpCatalog.filters.language.placeholder')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="javascript">JavaScript</SelectItem>
            <SelectItem value="typescript">TypeScript</SelectItem>
            <SelectItem value="python">Python</SelectItem>
            <SelectItem value="go">Go</SelectItem>
            <SelectItem value="rust">Rust</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" class="h-6 w-6" @click="removeFilter('language')">
          <X class="h-4 w-4" />
        </Button>
      </div>

      <!-- Runtime Filter -->
      <div v-if="props.visibleFilters.has('runtime')" class="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5">
        <span class="text-sm font-medium whitespace-nowrap">{{ t('mcpCatalog.filters.runtime.label') }}</span>
        <Select :model-value="props.filterValues.runtime" @update:model-value="(v) => updateFilterValue('runtime', String(v ?? ''))">
          <SelectTrigger class="h-7 w-[150px]">
            <SelectValue :placeholder="t('mcpCatalog.filters.runtime.placeholder')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="node">Node.js</SelectItem>
            <SelectItem value="python">Python</SelectItem>
            <SelectItem value="go">Go</SelectItem>
            <SelectItem value="docker">Docker</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" class="h-6 w-6" @click="removeFilter('runtime')">
          <X class="h-4 w-4" />
        </Button>
      </div>

      <!-- Featured Filter -->
      <div v-if="props.visibleFilters.has('featured')" class="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5">
        <span class="text-sm font-medium whitespace-nowrap">{{ t('mcpCatalog.filters.featured.label') }}</span>
        <Select :model-value="props.filterValues.featured" @update:model-value="(v) => updateFilterValue('featured', String(v ?? ''))">
          <SelectTrigger class="h-7 w-[150px]">
            <SelectValue :placeholder="t('mcpCatalog.filters.featured.placeholder')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">{{ t('mcpCatalog.filters.featured.yes') }}</SelectItem>
            <SelectItem value="no">{{ t('mcpCatalog.filters.featured.no') }}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" class="h-6 w-6" @click="removeFilter('featured')">
          <X class="h-4 w-4" />
        </Button>
      </div>

      <!-- Auto Install Filter -->
      <div v-if="props.visibleFilters.has('autoInstall')" class="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5">
        <span class="text-sm font-medium whitespace-nowrap">{{ t('mcpCatalog.filters.autoInstall.label') }}</span>
        <Select :model-value="props.filterValues.autoInstall" @update:model-value="(v) => updateFilterValue('autoInstall', String(v ?? ''))">
          <SelectTrigger class="h-7 w-[150px]">
            <SelectValue :placeholder="t('mcpCatalog.filters.autoInstall.placeholder')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">{{ t('mcpCatalog.filters.autoInstall.yes') }}</SelectItem>
            <SelectItem value="no">{{ t('mcpCatalog.filters.autoInstall.no') }}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" class="h-6 w-6" @click="removeFilter('autoInstall')">
          <X class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <!-- Dynamic Table Component (CONDITIONAL) -->
    <component
      :is="tableComponent"
      :servers="servers"
      :is-loading="isLoading"
      :on-edit-server="onEditServer"
      :on-toggle-status="onToggleStatus"
      :on-delete-server="onDeleteServer"
      @selection-change="handleSelectionChange"
    />
  </div>

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
