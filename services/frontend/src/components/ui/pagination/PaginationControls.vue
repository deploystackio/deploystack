<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

interface Props {
  currentPage: number
  pageSize: number
  totalItems: number
  isLoading?: boolean
  pageSizeOptions?: number[]
}

interface Emits {
  (e: 'page-change', page: number): void
  (e: 'page-size-change', pageSize: number): void
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  pageSizeOptions: () => [10, 20, 50, 100]
})

const emit = defineEmits<Emits>()
const { t } = useI18n()

// Computed properties
const totalPages = computed(() => Math.ceil(props.totalItems / props.pageSize))
const startItem = computed(() => {
  if (props.totalItems === 0) return 0
  return (props.currentPage - 1) * props.pageSize + 1
})
const endItem = computed(() => {
  const end = props.currentPage * props.pageSize
  return Math.min(end, props.totalItems)
})

const canGoPrevious = computed(() => props.currentPage > 1 && !props.isLoading)
const canGoNext = computed(() => props.currentPage < totalPages.value && !props.isLoading)

// Event handlers
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

function handlePageSizeChange(newPageSize: any) {
  if (newPageSize) {
    const size = typeof newPageSize === 'string' ? parseInt(newPageSize, 10) : Number(newPageSize)
    if (size !== props.pageSize && !isNaN(size)) {
      emit('page-size-change', size)
    }
  }
}
</script>

<template>
  <div class="flex items-center justify-between space-x-2 py-4">
    <!-- Left side: Items info -->
    <div class="flex-1 text-sm text-muted-foreground">
      <span v-if="totalItems > 0">
        {{ t('mcpCatalog.pagination.showing', {
          start: startItem,
          end: endItem,
          total: totalItems
        }) }}
      </span>
      <span v-else>
        {{ t('mcpCatalog.pagination.noItems') }}
      </span>
    </div>

    <!-- Right side: Controls -->
    <div class="flex items-center space-x-6">
      <!-- Items per page selector -->
      <div class="flex items-center space-x-2">
        <span class="text-sm text-muted-foreground whitespace-nowrap">
          {{ t('mcpCatalog.pagination.itemsPerPage') }}
        </span>
        <Select
          :model-value="String(pageSize)"
          @update:model-value="handlePageSizeChange"
          :disabled="isLoading"
        >
          <SelectTrigger class="h-8 w-[70px]">
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
      <div class="text-sm text-muted-foreground whitespace-nowrap">
        {{ t('mcpCatalog.pagination.pageInfo', {
          current: currentPage,
          total: totalPages
        }) }}
      </div>

      <!-- Navigation buttons -->
      <div class="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          :disabled="!canGoPrevious"
          @click="previousPage"
          class="h-8 px-3"
        >
          <ChevronLeft class="h-4 w-4 mr-1" />
          {{ t('mcpCatalog.pagination.previous') }}
        </Button>
        <Button
          variant="outline"
          size="sm"
          :disabled="!canGoNext"
          @click="nextPage"
          class="h-8 px-3"
        >
          {{ t('mcpCatalog.pagination.next') }}
          <ChevronRight class="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  </div>
</template>
