<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { McpCatalogService } from '@/services/mcpCatalogService'
import type { McpCategory } from '@/services/mcpCategoriesService'

const { t } = useI18n()

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

// Fetch category by ID if not provided as prop
async function fetchCategory(categoryId: string): Promise<McpCategory | null> {
  try {
    isLoading.value = true
    const categories = await McpCatalogService.getCategories()
    return categories.find(cat => cat.id === categoryId) || null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to fetch category'
    console.error('Failed to fetch category:', err)
    return null
  } finally {
    isLoading.value = false
  }
}

// Load category on mount if categoryId is provided but category is not
onMounted(async () => {
  if (props.categoryId && !props.category) {
    category.value = await fetchCategory(props.categoryId)
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
