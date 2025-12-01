<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { McpCatalogService } from '@/services/mcpCatalogService'
import { useEventBus } from '@/composables/useEventBus'
import type { McpCategory } from '@/services/mcpCategoriesService'

const { t } = useI18n()
const eventBus = useEventBus()

// Storage key for categories cache
const CATEGORIES_STORAGE_KEY = 'mcp_categories_cache'

interface Props {
  categoryId?: string | null
  category?: McpCategory | null
  showNotProvided?: boolean
  iconClass?: string
  textClass?: string
  containerClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  categoryId: null,
  category: null,
  showNotProvided: true,
  iconClass: 'h-4 w-4 text-muted-foreground',
  textClass: '',
  containerClass: 'flex items-center gap-2'
})

const category = ref<McpCategory | null>(props.category)
const isLoading = ref(false)
const error = ref<string | null>(null)

// Find category from cached categories in storage
function findCategoryFromCache(categoryId: string): McpCategory | null {
  const cached = eventBus.getState<McpCategory[]>(CATEGORIES_STORAGE_KEY)
  if (cached && Array.isArray(cached)) {
    return cached.find(cat => cat.id === categoryId) || null
  }
  return null
}

// Fetch categories and cache them in storage
async function fetchAndCacheCategories(): Promise<McpCategory[]> {
  const categories = await McpCatalogService.getCategories()
  eventBus.setState(CATEGORIES_STORAGE_KEY, categories)
  return categories
}

// Load category - check storage cache first, then fetch if needed
async function loadCategory(categoryId: string): Promise<void> {
  // First, try to find in storage cache (prevents redundant API calls)
  const cachedCategory = findCategoryFromCache(categoryId)
  if (cachedCategory) {
    category.value = cachedCategory
    return
  }

  // Not in cache, fetch from API
  try {
    isLoading.value = true
    error.value = null
    const categories = await fetchAndCacheCategories()
    category.value = categories.find(cat => cat.id === categoryId) || null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to fetch category'
    console.error('Failed to fetch category:', err)
  } finally {
    isLoading.value = false
  }
}

// Watch for categoryId changes (handles re-renders without remount)
watch(() => props.categoryId, (newId) => {
  if (newId && !props.category) {
    loadCategory(newId)
  }
}, { immediate: false })

// Load category on mount if categoryId is provided but category is not
onMounted(() => {
  if (props.categoryId && !props.category) {
    loadCategory(props.categoryId)
  }
})

// Computed property to determine what to display
const displayCategory = computed(() => {
  return props.category || category.value
})

const shouldShowNotProvided = computed(() => {
  return props.showNotProvided && !displayCategory.value && !isLoading.value
})
</script>

<template>
  <div v-if="displayCategory" :class="containerClass">
    <DynamicIcon 
      :name="displayCategory.icon" 
      :class="iconClass"
    />
    <span :class="textClass">{{ displayCategory.name }}</span>
  </div>
  
  <div v-else-if="isLoading" :class="containerClass">
    <div class="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
    <div class="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
  </div>
  
  <div v-else-if="shouldShowNotProvided" :class="textClass || 'text-muted-foreground'">
    {{ t('mcpCatalog.edit.values.notProvided') }}
  </div>
</template>
