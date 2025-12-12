<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { toast } from 'vue-sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { DsPageHeading } from '@/components/ui/ds-page-heading'
import { Plus } from 'lucide-vue-next'
import NavbarLayout from '@/components/NavbarLayout.vue'
import CategoryModal from '@/components/admin/mcp-categories/CategoryModal.vue'
import { McpCategoriesService, type McpCategory } from '@/services/mcpCategoriesService'
import { useEventBus } from '@/composables/useEventBus'
import CategoryTableColumns from './CategoryTableColumns.vue'

const { t } = useI18n()
const eventBus = useEventBus()
const { setBreadcrumbs } = useBreadcrumbs()

// State
const categories = ref<McpCategory[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')
const showAddModal = ref(false)
const editingCategory = ref<McpCategory | null>(null)

// Filter categories based on search query
const filteredCategories = computed(() => {
  if (!searchQuery.value) {
    return categories.value
  }
  const query = searchQuery.value.toLowerCase()
  return categories.value.filter(category =>
    category.name.toLowerCase().includes(query) ||
    (category.description && category.description.toLowerCase().includes(query)) ||
    (category.icon && category.icon.toLowerCase().includes(query))
  )
})

// Navigation handlers
const handleAddCategory = () => {
  editingCategory.value = null
  showAddModal.value = true
}

const handleEditCategory = (category: McpCategory) => {
  editingCategory.value = category
  showAddModal.value = true
}

const handleDeleteCategory = async (categoryId: string) => {
  try {
    await McpCategoriesService.deleteCategory(categoryId)

    // Remove from local state
    categories.value = categories.value.filter(c => c.id !== categoryId)

    // Show success toast
    toast.success(t('mcpCategories.messages.deleteSuccess'))

    // Emit global event
    eventBus.emit('mcp-categories-updated')
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to delete category'
    toast.error(t('mcpCategories.messages.deleteError'), {
      description: errorMessage
    })
  }
}

// Fetch categories from API
const fetchCategories = async (forceRefresh = false): Promise<void> => {
  try {
    isLoading.value = true
    error.value = null

    categories.value = await McpCategoriesService.getCategories(forceRefresh)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred'
    error.value = errorMessage
    categories.value = []
    
    // Show error toast for fetch failures
    toast.error(t('mcpCategories.messages.fetchError'), {
      description: errorMessage
    })
  } finally {
    isLoading.value = false
  }
}

// Handle category creation/update success
const handleCategorySuccess = (action: 'created' | 'updated') => {
  fetchCategories(true)
  
  // Show success toast
  const message = action === 'created'
    ? t('mcpCategories.messages.createSuccess')
    : t('mcpCategories.messages.updateSuccess')
  toast.success(message)

  // Emit global event
  eventBus.emit('mcp-categories-updated')
}

// Load data on component mount
onMounted(async () => {
  setBreadcrumbs([{ label: t('mcpCategories.title') }])
  await fetchCategories()

  // Listen for category updates from other components
  eventBus.on('mcp-categories-updated', () => {
    fetchCategories(true)
  })
})

onUnmounted(() => {
  // Clean up event listeners
  eventBus.off('mcp-categories-updated')
})
</script>

<template>
  <NavbarLayout>
    <DsPageHeading :title="t('mcpCategories.title')">
      <template #actions>
        <Button @click="handleAddCategory">
          <Plus class="h-4 w-4 mr-2" />
          {{ t('mcpCategories.addButton') }}
        </Button>
      </template>
    </DsPageHeading>

    <div class="space-y-6">
      <!-- Loading State -->
      <div v-if="isLoading" class="text-muted-foreground">
        {{ t('mcpCategories.table.loading') }}
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-red-500">
        {{ t('mcpCategories.table.error', { error }) }}
      </div>

      <!-- Data Table -->
      <div v-else class="space-y-4">
        <!-- Search Input -->
        <div class="flex items-center py-4">
          <Input
            :placeholder="t('mcpCategories.table.search.placeholder')"
            v-model="searchQuery"
            class="max-w-sm"
          />
        </div>

        <!-- Categories Table Component -->
        <CategoryTableColumns
          :categories="filteredCategories"
          :on-edit-category="handleEditCategory"
          :on-delete-category="handleDeleteCategory"
        />
      </div>

      <!-- Add/Edit Category Modal -->
      <CategoryModal
        v-model:open="showAddModal"
        :category="editingCategory"
        @category-created="() => handleCategorySuccess('created')"
        @category-updated="() => handleCategorySuccess('updated')"
      />
    </div>
  </NavbarLayout>
</template>
