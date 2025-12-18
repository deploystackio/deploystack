import { getEnv } from '@/utils/env'

// =============================================================================
// TYPESCRIPT INTERFACES
// =============================================================================

export interface McpTool {
  id: string
  tool_name: string
  description: string
  input_schema: unknown
  token_count: number
  is_disabled: boolean
  discovered_at: string
  updated_at: string
}

export interface ToggleToolResponse {
  tool_id: string
  tool_name: string
  is_disabled: boolean
  command_id?: string
  message: string
}

export interface BatchToggleToolRequest {
  tool_id: string
  is_disabled: boolean
}

export interface BatchToggleToolResult {
  tool_id: string
  tool_name?: string
  is_disabled?: boolean
  status: 'success' | 'failed' | 'skipped'
  message: string
}

export interface BatchToggleToolResponse {
  total_requested: number
  total_succeeded: number
  total_failed: number
  total_skipped: number
  command_ids?: string[]
  results: BatchToggleToolResult[]
}

export interface InstallationToolsResponse {
  installation_id: string
  installation_name: string
  team_id: string
  server_slug: string
  tool_count: number
  total_tokens: number
  tools: McpTool[]
}

export interface InstallationSummary {
  installation_id: string
  installation_name: string
  server_slug: string
  tool_count: number
  total_tokens: number
}

export interface TeamToolsSummaryResponse {
  team_id: string
  total_installations: number
  total_tools: number
  total_tokens: number
  hierarchical_tokens: number
  tokens_saved: number
  savings_percentage: number
  installations: InstallationSummary[]
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export class McpToolsService {
  private static baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

  /**
   * Get tools for a specific MCP installation
   */
  static async getInstallationTools(
    teamId: string,
    installationId: string
  ): Promise<InstallationToolsResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/tools`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to fetch installation tools: ${response.status}`)
    }

    const data = await response.json()
    return data.data || data
  }

  /**
   * Toggle tool enabled/disabled status
   */
  static async toggleToolStatus(
    teamId: string,
    installationId: string,
    toolId: string,
    isDisabled: boolean
  ): Promise<ToggleToolResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/tools/${toolId}`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_disabled: isDisabled }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      if (response.status === 403) {
        throw new Error('You don\'t have permission to manage tools')
      }
      if (response.status === 404) {
        throw new Error('Tool not found')
      }
      throw new Error(errorData.error || `Failed to update tool status: ${response.status}`)
    }

    const data = await response.json()
    return data.data || data
  }

  /**
   * Batch toggle tool enabled/disabled status for multiple tools
   */
  static async batchToggleTools(
    teamId: string,
    installationId: string,
    tools: BatchToggleToolRequest[]
  ): Promise<BatchToggleToolResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/tools`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tools }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      if (response.status === 403) {
        throw new Error('You don\'t have permission to manage tools')
      }
      throw new Error(errorData.error || `Failed to batch toggle tools: ${response.status}`)
    }

    const data = await response.json()
    return data.data || data
  }

  /**
   * Get team-wide tools summary (future phase)
   * Note: Backend endpoint not yet implemented
   */
  static async getTeamToolsSummary(teamId: string): Promise<TeamToolsSummaryResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/teams/${teamId}/mcp-tools/summary`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to fetch team tools summary: ${response.status}`)
    }

    const data = await response.json()
    return data.data || data
  }
}
