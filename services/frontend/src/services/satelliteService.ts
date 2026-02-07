import { getEnv } from '@/utils/env'

export interface Satellite {
  id: string
  name: string
  satellite_type: 'global' | 'team'
  status: 'active' | 'inactive' | 'maintenance' | 'error'
  capabilities: string[]
  satellite_url: string
  region: string | null
  last_heartbeat: string | null
  system_info: {
    os?: string
    arch?: string
    node_version?: string
    memory_mb?: number
  }
  created_at: string
  updated_at: string
  team?: {
    id: string
    name: string
    slug: string
  }
  created_by_user: {
    id: string
    username: string
    email: string
  }
}

export interface SatelliteListResponse {
  success: boolean
  data: {
    satellites: Satellite[]
    pagination: {
      page: number
      limit: number
      total: number
      pages: number
    }
  }
}

export interface SatelliteStatusUpdateResponse {
  success: boolean
  data: {
    satellite: Satellite
  }
  message: string
}

export interface SatelliteListParams {
  status?: string
  satellite_type?: string
  search?: string
  page?: number
  limit?: number
}

// Simplified interface for team satellites endpoint
export interface TeamSatellite {
  id: string
  name: string
  satellite_type: 'global' | 'team'
  status: 'active' | 'inactive' | 'maintenance' | 'error'
  capabilities: string[]
  team_id: string | null
  last_heartbeat: string | null
}

export interface TeamSatellitesResponse {
  success: boolean
  data: {
    satellites: TeamSatellite[]
    total_count: number
    global_count: number
    team_count: number
  }
}

// Command types
export interface SatelliteCommand {
  id: string
  satellite_id: string
  command_type: 'spawn' | 'kill' | 'restart' | 'configure' | 'health_check' | 'invalidate_user_token_cache'
  priority: 'immediate' | 'high' | 'normal' | 'low'
  payload: string // JSON string
  status: 'pending' | 'acknowledged' | 'executing' | 'completed' | 'failed'
  target_team_id: string | null
  correlation_id: string | null
  retry_count: number
  max_retries: number
  error_message: string | null
  result: string | null // JSON string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CommandsPagination {
  total: number
  limit: number
  offset: number
  has_more: boolean
}

export interface ListCommandsResponse {
  success: boolean
  data: {
    commands: SatelliteCommand[]
    pagination: CommandsPagination
  }
}

// Heartbeat types
export interface SatelliteHeartbeat {
  id: string
  satellite_id: string
  status: 'active' | 'degraded' | 'error'
  system_metrics: string // JSON string
  process_count: number
  healthy_process_count: number
  error_count: number
  response_time_ms: number | null
  uptime_seconds: number | null
  version: string | null
  timestamp: string
}

export interface SystemMetrics {
  cpu: number              // cpu_usage_percent (0-100)
  memory: number           // memory_usage_mb (absolute MB)
  disk: number             // disk_usage_percent (0-100)
  uptime_seconds: number   // process uptime
  network?: {
    rx: number
    tx: number
  }
}

export interface HeartbeatsPagination {
  total: number
  limit: number
  offset: number
  has_more: boolean
}

export interface ListHeartbeatsResponse {
  success: boolean
  data: {
    heartbeats: SatelliteHeartbeat[]
    pagination: HeartbeatsPagination
  }
}

export class SatelliteService {
  private static baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')
  private static cache: Map<string, { data: SatelliteListResponse; timestamp: number }> = new Map()
  private static readonly CACHE_DURATION = 30000 // 30 seconds

  private static getCacheKey(params: SatelliteListParams): string {
    return JSON.stringify(params)
  }

  private static isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION
  }

  static async getSatelliteById(id: string): Promise<Satellite> {
    try {
      const url = `${this.baseUrl}/api/satellites/manage/${id}`

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required')
        }
        if (response.status === 403) {
          throw new Error('Insufficient permissions to view satellite')
        }
        if (response.status === 404) {
          throw new Error('Satellite not found')
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      return result.data
    } catch (error) {
      console.error('Failed to fetch satellite:', error)
      throw error
    }
  }

  static async getSatellites(params: SatelliteListParams = {}, forceRefresh = false): Promise<SatelliteListResponse> {
    const cacheKey = this.getCacheKey(params)

    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!
      if (this.isCacheValid(cached.timestamp)) {
        return cached.data
      }
    }

    try {
      const queryParams = new URLSearchParams()

      if (params.status) queryParams.append('status', params.status)
      if (params.satellite_type) queryParams.append('satellite_type', params.satellite_type)
      if (params.search) queryParams.append('search', params.search)
      if (params.page) queryParams.append('page', params.page.toString())
      if (params.limit) queryParams.append('limit', params.limit.toString())

      const url = `${this.baseUrl}/api/satellites/manage${queryParams.toString() ? '?' + queryParams.toString() : ''}`

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required')
        }
        if (response.status === 403) {
          throw new Error('Insufficient permissions to view satellites')
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: SatelliteListResponse = await response.json()

      // Cache the successful response
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      })

      return data
    } catch (error) {
      console.error('Failed to fetch satellites:', error)
      throw error
    }
  }

  static async updateSatelliteStatus(satelliteId: string, status: Satellite['status']): Promise<SatelliteStatusUpdateResponse> {
    try {
      const url = `${this.baseUrl}/api/satellites/manage/${satelliteId}/status`

      const response = await fetch(url, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required')
        }
        if (response.status === 403) {
          throw new Error('Insufficient permissions to manage satellites')
        }
        if (response.status === 404) {
          throw new Error('Satellite not found')
        }
        if (response.status === 400) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Invalid status value')
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: SatelliteStatusUpdateResponse = await response.json()

      // Clear cache to ensure fresh data on next fetch
      this.clearCache()

      return data
    } catch (error) {
      console.error('Failed to update satellite status:', error)
      throw error
    }
  }

  static async updateSatellite(
    satelliteId: string,
    updates: {
      name?: string
      status?: Satellite['status']
      capabilities?: string[]
      satellite_url?: string
      region?: string | null
    }
  ): Promise<{ success: boolean; data: Satellite }> {
    try {
      const url = `${this.baseUrl}/api/satellites/manage/${satelliteId}`

      const response = await fetch(url, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required')
        }
        if (response.status === 403) {
          throw new Error('Insufficient permissions to manage satellites')
        }
        if (response.status === 404) {
          throw new Error('Satellite not found')
        }
        if (response.status === 400) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Invalid update data')
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Clear cache to ensure fresh data on next fetch
      this.clearCache()

      return data
    } catch (error) {
      console.error('Failed to update satellite:', error)
      throw error
    }
  }

  static async deleteSatellite(satelliteId: string): Promise<{ success: boolean; message: string }> {
    try {
      const url = `${this.baseUrl}/api/satellites/manage/${satelliteId}`

      const response = await fetch(url, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required')
        }
        if (response.status === 403) {
          throw new Error('Insufficient permissions to delete satellites')
        }
        if (response.status === 404) {
          throw new Error('Satellite not found')
        }
        if (response.status === 400) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Satellite must be inactive before deletion')
        }
        if (response.status === 409) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Satellite has active MCP installations')
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Clear cache to ensure fresh data on next fetch
      this.clearCache()

      return data
    } catch (error) {
      console.error('Failed to delete satellite:', error)
      throw error
    }
  }

  static async getTeamSatellites(teamId: string): Promise<TeamSatellitesResponse> {
    try {
      const url = `${this.baseUrl}/api/teams/${teamId}/satellites`

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required')
        }
        if (response.status === 403) {
          throw new Error('You do not have access to this team')
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: TeamSatellitesResponse = await response.json()
      return data
    } catch (error) {
      console.error('Failed to fetch team satellites:', error)
      throw error
    }
  }

  static clearCache(): void {
    this.cache.clear()
  }

  static formatLastHeartbeat(lastHeartbeat: string | null): string {
    if (!lastHeartbeat) {
      return 'Never'
    }

    const now = new Date()
    const heartbeatDate = new Date(lastHeartbeat)
    const diffMs = now.getTime() - heartbeatDate.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMinutes < 1) {
      return 'Just now'
    } else if (diffMinutes < 60) {
      return `${diffMinutes} min ago`
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    } else {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    }
  }

  static getStatusVariant(status: Satellite['status']): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (status) {
      case 'active':
        return 'default' // Green
      case 'inactive':
        return 'secondary' // Gray
      case 'maintenance':
        return 'outline' // Yellow/Orange
      case 'error':
        return 'destructive' // Red
      default:
        return 'secondary'
    }
  }

  static getTypeVariant(type: Satellite['satellite_type']): 'default' | 'secondary' {
    switch (type) {
      case 'global':
        return 'default'
      case 'team':
        return 'secondary'
      default:
        return 'secondary'
    }
  }

  /**
   * List satellite commands with pagination
   */
  static async listCommands(
    satelliteId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<ListCommandsResponse> {
    try {
      const params = new URLSearchParams()

      if (options.limit !== undefined) {
        params.append('limit', options.limit.toString())
      }
      if (options.offset !== undefined) {
        params.append('offset', options.offset.toString())
      }

      const queryString = params.toString()
      const url = `${this.baseUrl}/api/satellites/manage/${satelliteId}/commands${queryString ? `?${queryString}` : ''}`

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required')
        }
        if (response.status === 403) {
          throw new Error('Insufficient permissions')
        }
        if (response.status === 404) {
          throw new Error('Satellite not found')
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: ListCommandsResponse = await response.json()
      return data
    } catch (error) {
      console.error('Failed to fetch satellite commands:', error)
      throw error
    }
  }

  /**
   * List satellite heartbeats with pagination
   */
  static async listHeartbeats(
    satelliteId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<ListHeartbeatsResponse> {
    try {
      const params = new URLSearchParams()

      if (options.limit !== undefined) {
        params.append('limit', options.limit.toString())
      }
      if (options.offset !== undefined) {
        params.append('offset', options.offset.toString())
      }

      const queryString = params.toString()
      const url = `${this.baseUrl}/api/satellites/manage/${satelliteId}/heartbeats${queryString ? `?${queryString}` : ''}`

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required')
        }
        if (response.status === 403) {
          throw new Error('Insufficient permissions')
        }
        if (response.status === 404) {
          throw new Error('Satellite not found')
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: ListHeartbeatsResponse = await response.json()
      return data
    } catch (error) {
      console.error('Failed to fetch satellite heartbeats:', error)
      throw error
    }
  }
}
