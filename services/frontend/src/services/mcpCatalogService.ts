import { getEnv } from '@/utils/env'
import type {
  McpServer,
  McpCategory,
  CreateMcpServerRequest,
  UpdateMcpServerRequest,
  McpServerFilters
} from '@/views/admin/mcp-server-catalog/types'

export class McpCatalogService {
  private static baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

  /**
   * Get all global MCP servers (admin only)
   */
  static async getGlobalServers(filters?: McpServerFilters): Promise<McpServer[]> {
    const url = new URL(`${this.baseUrl}/api/mcp/servers`)

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.append(key, String(value))
        }
      })
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to fetch MCP servers: ${response.status}`)
    }

    const data = await response.json()
    return data.data || data
  }

  /**
   * Get a specific MCP server by ID
   */
  static async getServerById(serverId: string): Promise<McpServer> {
    const response = await fetch(`${this.baseUrl}/api/mcp/servers/${serverId}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to fetch MCP server: ${response.status}`)
    }

    const data = await response.json()
    return data.data || data
  }

  /**
   * Create a new global MCP server (admin only)
   */
  static async createGlobalServer(serverData: CreateMcpServerRequest): Promise<McpServer> {
    const response = await fetch(`${this.baseUrl}/api/mcp/servers/global`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...serverData,
        visibility: 'global'
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to create MCP server: ${response.status}`)
    }

    const data = await response.json()
    return data.data || data
  }

  /**
   * Update a global MCP server (admin only)
   */
  static async updateGlobalServer(serverId: string, serverData: UpdateMcpServerRequest): Promise<McpServer> {
    const response = await fetch(`${this.baseUrl}/api/mcp/servers/global/${serverId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(serverData),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to update MCP server: ${response.status}`)
    }

    const data = await response.json()
    return data.data || data
  }

  /**
   * Delete a global MCP server (admin only)
   */
  static async deleteGlobalServer(serverId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/mcp/servers/global/${serverId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to delete MCP server: ${response.status}`)
    }
  }

  /**
   * Search MCP servers
   */
  static async searchServers(query: string): Promise<McpServer[]> {
    const response = await fetch(`${this.baseUrl}/api/mcp/servers/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to search MCP servers: ${response.status}`)
    }

    const data = await response.json()
    return data.data || data
  }

  /**
   * Get all MCP categories
   */
  static async getCategories(): Promise<McpCategory[]> {
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
    return data.data || data
  }

  /**
   * Get GitHub repository information
   */
  static async getGitHubRepoInfo(repoUrl: string, branch: string = 'main'): Promise<any> {
    const url = new URL(`${this.baseUrl}/api/mcp/github/repo-info`)
    url.searchParams.append('url', repoUrl)
    url.searchParams.append('branch', branch)

    const response = await fetch(url.toString(), {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to fetch repository info: ${response.status}`)
    }

    return await response.json()
  }

  /**
   * Toggle featured status of a server (admin only)
   */
  static async toggleFeatured(serverId: string, featured: boolean): Promise<McpServer> {
    return this.updateGlobalServer(serverId, { featured })
  }

  /**
   * Update server status (admin only)
   */
  static async updateStatus(serverId: string, status: 'active' | 'deprecated' | 'maintenance'): Promise<McpServer> {
    return this.updateGlobalServer(serverId, { status })
  }
}

// Cache for categories to avoid repeated API calls
let categoriesCache: McpCategory[] | null = null
let categoriesCacheTime: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export class McpCategoriesCache {
  static async getCategories(forceRefresh = false): Promise<McpCategory[]> {
    const now = Date.now()

    if (!forceRefresh && categoriesCache && (now - categoriesCacheTime) < CACHE_DURATION) {
      return categoriesCache
    }

    try {
      categoriesCache = await McpCatalogService.getCategories()
      categoriesCacheTime = now
      return categoriesCache
    } catch (error) {
      // If cache exists and API fails, return cached data
      if (categoriesCache) {
        console.warn('Failed to refresh categories, using cached data:', error)
        return categoriesCache
      }
      throw error
    }
  }

  static clearCache(): void {
    categoriesCache = null
    categoriesCacheTime = 0
  }
}
