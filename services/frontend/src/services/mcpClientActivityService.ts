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
   * Get SSE stream URL for real-time client activity updates
   *
   * @param teamId - Team ID to filter activity by
   * @param params - Optional query parameters
   * @returns SSE stream URL
   */
  static getStreamUrl(
    teamId: string,
    params: GetClientActivityParams = {}
  ): string {
    if (typeof teamId !== 'string' || !teamId) {
      throw new Error(
        'teamId must be a non-empty string. Did you pass the team object instead of team.id?'
      )
    }

    const queryParams = new URLSearchParams()
    queryParams.append('team_id', teamId)
    if (params.limit) queryParams.append('limit', params.limit.toString())
    if (params.active_within_minutes) {
      queryParams.append('active_within_minutes', params.active_within_minutes.toString())
    }

    return `${this.baseUrl}/api/users/me/mcp/client-activity/stream?${queryParams.toString()}`
  }

  /**
   * Get current user's active MCP client connections for a specific team
   *
   * @param teamId - Team ID to filter activity by (must be a string)
   * @param params - Optional query parameters
   * @returns MCP client activity response
   */
  static async getMyClientActivity(
    teamId: string,
    params: GetClientActivityParams = {}
  ): Promise<McpClientActivityResponse> {
    // Runtime validation to catch common mistake of passing team object instead of team ID
    if (typeof teamId !== 'string' || !teamId) {
      throw new Error(
        'teamId must be a non-empty string. Did you pass the team object instead of team.id?'
      )
    }

    const queryParams = new URLSearchParams()
    
    // Required parameter
    queryParams.append('team_id', teamId)
    
    if (params.limit) queryParams.append('limit', params.limit.toString())
    if (params.offset) queryParams.append('offset', params.offset.toString())
    if (params.active_within_minutes) {
      queryParams.append('active_within_minutes', params.active_within_minutes.toString())
    }

    const url = `${this.baseUrl}/api/users/me/mcp/client-activity?${queryParams.toString()}`

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
