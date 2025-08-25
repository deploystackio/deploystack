import { ref } from 'vue'
import type { McpCategory } from '@/views/admin/mcp-server-catalog/types'
import { McpCategoriesCache } from '@/services/mcpCatalogService'

/**
 * Composable for managing MCP categories
 * Provides reactive categories list with loading state
 */
export function useCategories() {
  const categories = ref<McpCategory[]>([])
  const categoriesLoading = ref(true)

  const loadCategories = async () => {
    try {
      categoriesLoading.value = true
      categories.value = await McpCategoriesCache.getCategories()
    } catch (error) {
      console.error('Failed to load categories:', error)
    } finally {
      categoriesLoading.value = false
    }
  }

  return {
    categories,
    categoriesLoading,
    loadCategories
  }
}
