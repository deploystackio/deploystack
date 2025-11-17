import { getEnv } from '@/utils/env'
import type { TeamMcpToolsStatsResponse } from '@/types/mcpStats'

export class McpToolsStatsService {
  private static baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

  /**
   * Get MCP tools token statistics for a team
   * @param teamId - The team ID to fetch stats for
   * @returns Promise with team MCP tools statistics
   */
  static async getTeamMcpToolsStats(teamId: string): Promise<TeamMcpToolsStatsResponse> {
    const response = await fetch(`${this.baseUrl}/api/teams/${teamId}/mcp/tools/stats`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch MCP tools stats: ${response.statusText}`)
    }

    return response.json()
  }
}
