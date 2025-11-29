import { getEnv } from '@/utils/env'

// Types
export interface McpCategory {
  id: string
  name: string
  description?: string | null
  icon?: string | null
  sort_order: number
  server_count: number
  created_at: string
}

export interface CreateMcpCategoryRequest {
  name: string
  description?: string
  icon?: string
  sort_order?: number
}

export interface UpdateMcpCategoryRequest {
  name?: string
  description?: string
  icon?: string
  sort_order?: number
}

export interface McpCategoriesResponse {
  success: boolean
  data: McpCategory[]
}

export interface McpCategoryResponse {
  success: boolean
  data: McpCategory
}

export interface ApiErrorResponse {
  success: boolean
  error: string
}

export class McpCategoriesService {
  private static baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')
  private static cache: McpCategory[] | null = null
  private static cacheTimestamp: number = 0
  private static readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  /**
   * Get all MCP categories with smart caching
   */
  static async getCategories(forceRefresh = false): Promise<McpCategory[]> {
    const now = Date.now()

    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && this.cache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.cache
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/mcp/categories`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Failed to fetch categories: ${response.status}`)
      }

      const data = await response.json()
      const categories = data.data || data

      this.cache = categories
      this.cacheTimestamp = now
      return categories
    } catch (error) {
      console.error('Error fetching MCP categories:', error)
      throw error instanceof Error ? error : new Error('Failed to fetch categories')
    }
  }

  /**
   * Create a new MCP category
   */
  static async createCategory(data: CreateMcpCategoryRequest): Promise<McpCategory> {
    try {
      const response = await fetch(`${this.baseUrl}/api/mcp/categories`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || `Failed to create category: ${response.status}`)
      }

      const result = await response.json()
      const category = result.data || result

      // Invalidate cache
      this.clearCache()
      return category
    } catch (error) {
      console.error('Error creating MCP category:', error)
      throw error instanceof Error ? error : new Error('Failed to create category')
    }
  }

  /**
   * Update an existing MCP category
   */
  static async updateCategory(categoryId: string, data: UpdateMcpCategoryRequest): Promise<McpCategory> {
    try {
      const response = await fetch(`${this.baseUrl}/api/mcp/categories/${categoryId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || `Failed to update category: ${response.status}`)
      }

      const result = await response.json()
      const category = result.data || result

      // Invalidate cache
      this.clearCache()
      return category
    } catch (error) {
      console.error('Error updating MCP category:', error)
      throw error instanceof Error ? error : new Error('Failed to update category')
    }
  }

  /**
   * Delete an MCP category
   */
  static async deleteCategory(categoryId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/mcp/categories/${categoryId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || `Failed to delete category: ${response.status}`)
      }

      // Invalidate cache
      this.clearCache()
    } catch (error) {
      console.error('Error deleting MCP category:', error)
      throw error instanceof Error ? error : new Error('Failed to delete category')
    }
  }

  /**
   * Get a single category by ID
   */
  static async getCategoryById(categoryId: string): Promise<McpCategory | null> {
    try {
      // First try to find in cache
      if (this.cache) {
        const cached = this.cache.find(cat => cat.id === categoryId)
        if (cached) return cached
      }

      // If not in cache, fetch all categories (which will update cache)
      const categories = await this.getCategories()
      return categories.find(cat => cat.id === categoryId) || null
    } catch (error) {
      console.error('Error fetching MCP category by ID:', error)
      throw error instanceof Error ? error : new Error('Failed to fetch category')
    }
  }

  /**
   * Clear the categories cache
   */
  static clearCache(): void {
    this.cache = null
    this.cacheTimestamp = 0
  }

  /**
   * Check if cache is valid
   */
  static isCacheValid(): boolean {
    const now = Date.now()
    return this.cache !== null && (now - this.cacheTimestamp) < this.CACHE_DURATION
  }
}
