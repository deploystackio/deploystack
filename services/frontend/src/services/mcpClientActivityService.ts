import { getEnv } from '@/utils/env'

export interface McpClientActivity {
  id: string
  client_name: string
  satellite: {
    id: string
    name: string
  }
  last_activity_at: string
  total_requests: number
  total_tool_calls: number
  user_agent: string
  first_seen_at: string
}

export interface McpClientActivityResponse {
  success: boolean
  data: {
    activities: McpClientActivity[]
    pagination: {
      total: number
      limit: number
      offset: number
      has_more: boolean
    }
  }
}

export interface GetClientActivityParams {
  limit?: number
  offset?: number
  active_within_minutes?: number
}

export class McpClientActivityService {
  private static baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

  /**
   * Get current user's active MCP client connections
   */
  static async getMyClientActivity(
    params: GetClientActivityParams = {}
  ): Promise<McpClientActivityResponse> {
    const queryParams = new URLSearchParams()
    
    if (params.limit) queryParams.append('limit', params.limit.toString())
    if (params.offset) queryParams.append('offset', params.offset.toString())
    if (params.active_within_minutes) {
      queryParams.append('active_within_minutes', params.active_within_minutes.toString())
    }

    const url = `${this.baseUrl}/api/users/me/mcp/client-activity${queryParams.toString() ? `?${queryParams.toString()}` : ''}`

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.message || `Failed to fetch MCP client activity: ${response.status}`
      )
    }

    return response.json()
  }
}
