import { getEnv } from '@/utils/env'

export interface Satellite {
  id: string
  name: string
  satellite_type: 'global' | 'team'
  status: 'active' | 'inactive' | 'maintenance' | 'error'
  capabilities: string[]
  last_heartbeat: string | null
  system_info: {
    os?: string
    arch?: string
    memory?: string
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
}
