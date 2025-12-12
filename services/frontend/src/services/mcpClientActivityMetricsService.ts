import { getEnv } from '@/utils/env'

export interface MetricBucket {
  timestamp: string
  request_count: number
  tool_call_count: number
  active_client_count: number
}

export interface MetricTimeRange {
  start: string
  end: string
  interval: string
}

export interface MetricFilters {
  user_id: string
  team_id: string
  satellite_id?: string
  auth_identifier?: string
}

export interface MetricSummary {
  total_buckets: number
  total_requests: number
  total_tool_calls: number
  peak_requests: number
  peak_timestamp?: string
  average_requests: number
}

export interface McpClientActivityMetricsResponse {
  success: boolean
  data: {
    metric_type: string
    time_range: MetricTimeRange
    filters: MetricFilters
    buckets: MetricBucket[]
    summary: MetricSummary
  }
}

export interface GetMetricsParams {
  team_id: string
  time_range?: '1h' | '3h' | '6h' | '12h' | '24h' | '3d'
  interval?: '15m'
  satellite_id?: string
  auth_identifier?: string
}

export class McpClientActivityMetricsService {
  private static baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

  /**
   * Get time-series metrics for authenticated user's MCP client activity
   * 
   * @param params - Query parameters including required team_id
   * @returns Time-series metrics response
   */
  static async getMetrics(
    params: GetMetricsParams
  ): Promise<McpClientActivityMetricsResponse> {
    if (!params.team_id || typeof params.team_id !== 'string') {
      throw new Error('team_id is required and must be a string')
    }

    const queryParams = new URLSearchParams()
    
    queryParams.append('team_id', params.team_id)
    
    if (params.time_range) queryParams.append('time_range', params.time_range)
    if (params.interval) queryParams.append('interval', params.interval)
    if (params.satellite_id) queryParams.append('satellite_id', params.satellite_id)
    if (params.auth_identifier) queryParams.append('auth_identifier', params.auth_identifier)

    const url = `${this.baseUrl}/api/me/metrics/mcp/client-activity?${queryParams.toString()}`

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
        errorData.error || `Failed to fetch metrics: ${response.status}`
      )
    }

    return response.json()
  }

  /**
   * Get SSE stream URL for real-time metrics updates
   *
   * @param params - Query parameters including required team_id
   * @returns SSE stream URL
   */
  static getStreamUrl(params: GetMetricsParams): string {
    if (!params.team_id || typeof params.team_id !== 'string') {
      throw new Error('team_id is required and must be a string')
    }

    const queryParams = new URLSearchParams()

    queryParams.append('team_id', params.team_id)

    if (params.time_range) queryParams.append('time_range', params.time_range)
    if (params.interval) queryParams.append('interval', params.interval)
    if (params.satellite_id) queryParams.append('satellite_id', params.satellite_id)
    if (params.auth_identifier) queryParams.append('auth_identifier', params.auth_identifier)

    return `${this.baseUrl}/api/me/metrics/mcp/client-activity/stream?${queryParams.toString()}`
  }
}
