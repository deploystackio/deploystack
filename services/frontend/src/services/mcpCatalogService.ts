/* eslint-disable @typescript-eslint/no-explicit-any */

import { getEnv } from '@/utils/env'
import type {
  McpServer,
  CreateMcpServerRequest,
  UpdateMcpServerRequest,
  McpServerFilters
} from '@/views/admin/mcp-server-catalog/types'
import { McpCategoriesService, type McpCategory } from '@/services/mcpCategoriesService'
import type { McpServerSearchParams, McpServerSearchResponse } from '@/types/mcp-catalog'

export interface PaginationParams {
  limit?: number
  offset?: number
}

export interface BulkDeleteJob {
  server_id: string
  server_name: string
  job_id: string
}

export interface BulkDeleteSkipped {
  server_id: string
  reason: string
}

export interface BulkDeleteResponse {
  total_requested: number
  total_queued: number
  total_skipped: number
  jobs: BulkDeleteJob[]
  skipped: BulkDeleteSkipped[]
}

export interface FeaturedCategory {
  id: string
  name: string
  description: string | null
  icon: string | null
  sort_order: number
  featured_server_count: number
}

export interface PaginationMeta {
  total: number
  limit: number
  offset: number
  has_more: boolean
}

export interface PaginatedResponse<T> {
  items: T[]
  pagination: PaginationMeta
}

export class McpCatalogService {
  private static baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

  /**
   * Parse server data from API response to ensure proper typing
   */
  private static parseServerData(server: any): McpServer {
    const safeJsonParse = (value: any, fallback: any = null) => {
      if (!value || value === 'null' || value === 'undefined') {
        return fallback
      }

      // If it's already an object/array, return as-is
      if (typeof value === 'object') {
        return value
      }

      // If it's a string, try to parse it
      if (typeof value === 'string') {
        // Handle the case where objects were stringified incorrectly as "[object Object],[object Object]"
        if (value.includes('[object Object]')) {
          // Silently handle malformed object strings - this is expected for some legacy data
          return fallback
        }

        // First try JSON parsing
        try {
          return JSON.parse(value)
        } catch (error) {
          // If JSON parsing fails, check if it's a comma-separated string (for tags)
          if (value.includes(',') && !value.startsWith('[') && !value.startsWith('{')) {
            // Split by comma and trim whitespace, filter out empty and malformed entries
            const items = value.split(',')
              .map(item => item.trim())
              .filter(item => item.length > 0 && !item.includes('[object Object]'))

            return items.length > 0 ? items : fallback
          }
          console.warn('Failed to parse JSON field:', value, error)
          return fallback
        }
      }

      return fallback
    }

    return {
      ...server,
      tags: safeJsonParse(server.tags, null),
      packages: safeJsonParse(server.packages, null),
      remotes: safeJsonParse(server.remotes, null),
      tools: safeJsonParse(server.tools, []),
      resources: safeJsonParse(server.resources, null),
      prompts: safeJsonParse(server.prompts, null),
      environment_variables: safeJsonParse(server.environment_variables, null),
      default_config: safeJsonParse(server.default_config, null),
      dependencies: safeJsonParse(server.dependencies, null),
      template_args: safeJsonParse(server.template_args, []),
      template_env: safeJsonParse(server.template_env, []),
      template_headers: safeJsonParse(server.template_headers, []),
      template_url_query_params: safeJsonParse(server.template_url_query_params, []),
      team_args_schema: safeJsonParse(server.team_args_schema, []),
      team_env_schema: safeJsonParse(server.team_env_schema, []),
      team_headers_schema: safeJsonParse(server.team_headers_schema, []),
      team_url_query_params_schema: safeJsonParse(server.team_url_query_params_schema, []),
      user_args_schema: safeJsonParse(server.user_args_schema, []),
      user_env_schema: safeJsonParse(server.user_env_schema, []),
      user_headers_schema: safeJsonParse(server.user_headers_schema, []),
      user_url_query_params_schema: safeJsonParse(server.user_url_query_params_schema, [])
    }
  }

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

    // Handle paginated response structure
    if (data.data && data.data.servers && Array.isArray(data.data.servers)) {
      return data.data.servers.map(this.parseServerData)
    }

    // Fallback for non-paginated response (backward compatibility)
    const servers = data.data || data
    return Array.isArray(servers) ? servers.map(this.parseServerData) : []
  }

  /**
   * Get global MCP servers with pagination support (admin only)
   */
  static async getGlobalServersPaginated(
    filters?: McpServerFilters,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<McpServer>> {
    const url = new URL(`${this.baseUrl}/api/mcp/servers`)

    // Add filters
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.append(key, String(value))
        }
      })
    }

    // Add pagination parameters
    if (pagination) {
      if (pagination.limit !== undefined) {
        url.searchParams.append('limit', String(pagination.limit))
      }
      if (pagination.offset !== undefined) {
        url.searchParams.append('offset', String(pagination.offset))
      }
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

    // Handle paginated response structure
    if (data.data && data.data.servers && data.data.pagination) {
      return {
        items: data.data.servers.map(this.parseServerData),
        pagination: data.data.pagination
      }
    }

    // Fallback for non-paginated response (backward compatibility)
    const servers = data.data || data
    return {
      items: Array.isArray(servers) ? servers.map(this.parseServerData) : [],
      pagination: {
        total: Array.isArray(servers) ? servers.length : 0,
        limit: pagination?.limit || 20,
        offset: pagination?.offset || 0,
        has_more: false
      }
    }
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
    return this.parseServerData(data.data || data)
  }

  /**
   * Get README content for a specific MCP server by ID
   */
  static async getServerReadme(serverId: string): Promise<string | null> {
    const response = await fetch(`${this.baseUrl}/api/mcp/servers/${serverId}/readme`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to fetch server README: ${response.status}`)
    }

    const data = await response.json()
    return data.data?.github_readme_base64 || null
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
    return this.parseServerData(data.data || data)
  }

  /**
   * Update a global MCP server (admin only)
   */
  static async updateGlobalServer(serverId: string, serverData: UpdateMcpServerRequest): Promise<McpServer> {
    const response = await fetch(`${this.baseUrl}/api/mcp/servers/global/${serverId}`, {
      method: 'PUT',
      mode: 'cors',
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
    return this.parseServerData(data.data || data)
  }

  /**
   * Delete a global MCP server (admin only)
   */
  static async deleteGlobalServer(serverId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/mcp/servers/global/${serverId}`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to delete MCP server: ${response.status}`)
    }
  }

  /**
   * Bulk delete global MCP servers (admin only)
   * Creates background jobs for each server deletion
   */
  static async bulkDeleteGlobalServers(serverIds: string[]): Promise<BulkDeleteResponse> {
    const response = await fetch(`${this.baseUrl}/api/mcp/servers/global/bulk-delete`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ server_ids: serverIds }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to bulk delete MCP servers: ${response.status}`)
    }

    const data = await response.json()
    return data.data
  }

  /**
   * Search MCP servers with advanced filters
   */
  static async searchServers(params: McpServerSearchParams): Promise<McpServerSearchResponse> {
    const url = new URL(`${this.baseUrl}/api/mcp/servers/search`)

    // Required parameter
    url.searchParams.append('q', params.q)

    // Optional parameters
    if (params.category) url.searchParams.append('category_id', params.category)
    if (params.language) url.searchParams.append('language', params.language)
    if (params.runtime) url.searchParams.append('runtime', params.runtime)
    if (params.status) url.searchParams.append('status', params.status)
    if (params.featured !== undefined) url.searchParams.append('featured', params.featured.toString())
    if (params.sort_by) url.searchParams.append('sort_by', params.sort_by)
    if (params.limit) url.searchParams.append('limit', params.limit.toString())
    if (params.offset) url.searchParams.append('offset', params.offset.toString())

    const response = await fetch(url.toString(), {
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

    return {
      servers: (data.data?.servers || []).map(this.parseServerData),
      pagination: data.data?.pagination || {
        total: 0,
        limit: params.limit || 50,
        offset: params.offset || 0,
        has_more: false
      },
      filters: data.data?.filters || {
        query: params.q,
        category: params.category || null,
        language: params.language || null,
        runtime: params.runtime || null,
        status: params.status || null,
        featured: params.featured || null
      }
    }
  }

  /**
   * Parse repository URL to extract platform information
   */
  static parseRepositoryUrl(repoUrl: string): {
    source: string
    owner: string
    repo: string
    subfolder?: string
  } | null {
    try {
      const url = new URL(repoUrl)
      const hostname = url.hostname.toLowerCase()
      const pathParts = url.pathname.split('/').filter(part => part.length > 0)

      if (pathParts.length < 2 || !pathParts[0] || !pathParts[1]) {
        return null
      }

      const owner = pathParts[0]
      const repo = pathParts[1].replace(/\.git$/, '')
      let source: string

      if (hostname === 'github.com' || hostname === 'www.github.com') {
        source = 'github'
      } else if (hostname.includes('gitlab')) {
        source = 'gitlab'
      } else if (hostname.includes('bitbucket')) {
        source = 'bitbucket'
      } else {
        return null
      }

      return { source, owner, repo }
    } catch {
      return null
    }
  }

  /**
   * Validate if a repository URL is supported
   */
  static isSupportedRepository(repoUrl: string): boolean {
    return this.parseRepositoryUrl(repoUrl) !== null
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
   * Get categories that have featured MCP servers
   */
  static async getFeaturedCategories(): Promise<FeaturedCategory[]> {
    const response = await fetch(`${this.baseUrl}/api/mcp/categories/featured`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to fetch featured categories: ${response.status}`)
    }

    const data = await response.json()
    return data.data || []
  }

  /**
   * Get repository information from any supported platform
   */
  static async getRepositoryInfo(repoUrl: string, branch: string = 'main'): Promise<any> {
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
   * Get GitHub repository information (legacy method for backward compatibility)
   * @deprecated Use getRepositoryInfo instead
   */
  static async getGitHubRepoInfo(repoUrl: string, branch: string = 'main'): Promise<any> {
    return this.getRepositoryInfo(repoUrl, branch)
  }

  /**
   * Get supported repository platforms
   */
  static getSupportedPlatforms(): Array<{ value: string; label: string; hostname: string }> {
    return [
      { value: 'github', label: 'GitHub', hostname: 'github.com' },
      { value: 'gitlab', label: 'GitLab', hostname: 'gitlab.com' },
      { value: 'bitbucket', label: 'Bitbucket', hostname: 'bitbucket.org' }
    ]
  }

  /**
   * Get the display name for a repository platform
   */
  static getPlatformDisplayName(source: string): string {
    const platforms = this.getSupportedPlatforms()
    const platform = platforms.find(p => p.value === source)
    return platform ? platform.label : source
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
  static async updateStatus(serverId: string, status: 'active' | 'deprecated' | 'maintenance' | 'disabled'): Promise<McpServer> {
    return this.updateGlobalServer(serverId, { status })
  }

  /**
   * Update global server status using dedicated PATCH endpoint (admin only)
   * This endpoint is specifically for status changes and returns previous status
   */
  static async updateGlobalServerStatus(
    serverId: string,
    status: 'active' | 'deprecated' | 'maintenance' | 'disabled'
  ): Promise<{ id: string; name: string; slug: string; status: string; previous_status: string; updated_at: string }> {
    const response = await fetch(`${this.baseUrl}/api/mcp/servers/global/${serverId}/status`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to update server status: ${response.status}`)
    }

    const data = await response.json()
    return data.data
  }

  /**
   * Get all unique runtime environments
   */
  static async getRuntimes(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/api/mcp/servers/runtimes`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to fetch runtimes: ${response.status}`)
    }

    const data = await response.json()
    return data.data?.runtimes || []
  }

  /**
   * Get all unique programming languages
   */
  static async getLanguages(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/api/mcp/servers/languages`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to fetch languages: ${response.status}`)
    }

    const data = await response.json()
    return data.data?.languages || []
  }
}

// Export McpCategoriesCache for backward compatibility
// This delegates to the dedicated McpCategoriesService
export class McpCategoriesCache {
  static async getCategories(forceRefresh = false): Promise<McpCategory[]> {
    return McpCategoriesService.getCategories(forceRefresh)
  }

  static clearCache(): void {
    McpCategoriesService.clearCache()
  }
}
