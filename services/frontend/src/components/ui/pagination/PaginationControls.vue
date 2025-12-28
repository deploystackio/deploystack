<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-vue-next'

interface Props {
  currentPage: number
  pageSize: number
  totalItems: number
  isLoading?: boolean
  pageSizeOptions?: number[]
  // Optional selection support
  selectedCount?: number
  totalRows?: number
}

interface Emits {
  (e: 'page-change', page: number): void
  (e: 'page-size-change', pageSize: number): void
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  pageSizeOptions: () => [10, 20, 30, 40, 50]
})

const emit = defineEmits<Emits>()
const { t } = useI18n()

// Computed properties
const totalPages = computed(() => Math.ceil(props.totalItems / props.pageSize))

const canGoPrevious = computed(() => props.currentPage > 1 && !props.isLoading)
const canGoNext = computed(() => props.currentPage < totalPages.value && !props.isLoading)

// Selection support
const hasSelection = computed(() => props.selectedCount !== undefined && props.totalRows !== undefined)

// Event handlers
function firstPage() {
  if (canGoPrevious.value) {
    emit('page-change', 1)
  }
}

function previousPage() {
  if (canGoPrevious.value) {
    emit('page-change', props.currentPage - 1)
  }
}

function nextPage() {
  if (canGoNext.value) {
    emit('page-change', props.currentPage + 1)
  }
}

function lastPage() {
  if (canGoNext.value) {
    emit('page-change', totalPages.value)
  }
}

function handlePageSizeChange(newPageSize: unknown) {
  if (newPageSize && typeof newPageSize === 'string') {
    const size = parseInt(newPageSize, 10)
    if (size !== props.pageSize && !isNaN(size)) {
      emit('page-size-change', size)
    }
  }
}
</script>

<template>
  <div class="flex items-center px-4 py-4" :class="hasSelection ? 'justify-between' : 'justify-end'">
    <!-- Left side: Selection info (only shown when selection is enabled) -->
    <div
      v-if="hasSelection"
      class="flex-1 text-sm text-muted-foreground"
    >
      {{ t('mcpCatalog.pagination.rowsSelected', {
        selected: selectedCount,
        total: totalRows
      }) }}
    </div>

    <!-- Right side: All controls grouped together -->
    <div class="flex w-full items-center gap-8 lg:w-fit" :class="{ 'justify-end': !hasSelection }">
      <!-- Rows per page selector (hidden on mobile) -->
      <div class="hidden items-center gap-2 lg:flex">
        <Label
          for="rows-per-page"
          class="text-sm font-medium"
        >
          {{ t('mcpCatalog.pagination.rowsPerPage') }}
        </Label>
        <Select
          :model-value="String(pageSize)"
          @update:model-value="handlePageSizeChange"
          :disabled="isLoading"
        >
          <SelectTrigger
            id="rows-per-page"
            class="w-20"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent side="top">
            <SelectItem
              v-for="option in pageSizeOptions"
              :key="option"
              :value="String(option)"
            >
              {{ option }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Page info -->
      <div class="flex w-fit items-center justify-center text-sm font-medium">
        {{ t('mcpCatalog.pagination.pageInfo', {
          current: currentPage,
          total: totalPages
        }) }}
      </div>

      <!-- Navigation buttons -->
      <div class="ml-auto flex items-center gap-2 lg:ml-0">
        <!-- First page (hidden on mobile) -->
        <Button
          variant="outline"
          size="icon"
          class="hidden size-8 lg:flex"
          :disabled="!canGoPrevious"
          @click="firstPage"
        >
          <span class="sr-only">{{ t('mcpCatalog.pagination.firstPage') }}</span>
          <ChevronsLeft class="size-4" />
        </Button>

        <!-- Previous page -->
        <Button
          variant="outline"
          size="icon"
          class="size-8"
          :disabled="!canGoPrevious"
          @click="previousPage"
        >
          <span class="sr-only">{{ t('mcpCatalog.pagination.previousPage') }}</span>
          <ChevronLeft class="size-4" />
        </Button>

        <!-- Next page -->
        <Button
          variant="outline"
          size="icon"
          class="size-8"
          :disabled="!canGoNext"
          @click="nextPage"
        >
          <span class="sr-only">{{ t('mcpCatalog.pagination.nextPage') }}</span>
          <ChevronRight class="size-4" />
        </Button>

        <!-- Last page (hidden on mobile) -->
        <Button
          variant="outline"
          size="icon"
          class="hidden size-8 lg:flex"
          :disabled="!canGoNext"
          @click="lastPage"
        >
          <span class="sr-only">{{ t('mcpCatalog.pagination.lastPage') }}</span>
          <ChevronsRight class="size-4" />
        </Button>
      </div>
    </div>
  </div>
</template>
