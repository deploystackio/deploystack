import { defineStore } from 'pinia'
import { ref } from 'vue'
import { McpToolsStatsService } from '@/services/mcpToolsStatsService'
import type { TeamMcpToolsStatsResponse } from '@/types/mcpStats'

export const useMcpToolsStatsStore = defineStore('mcpToolsStats', () => {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Fetch MCP tools token statistics for a team
   * Following the no-cache pattern - always fetches fresh data
   * @param teamId - The team ID to fetch stats for
   * @returns Promise with team MCP tools statistics
   */
  async function fetchStats(teamId: string): Promise<TeamMcpToolsStatsResponse> {
    isLoading.value = true
    error.value = null

    try {
      const data = await McpToolsStatsService.getTeamMcpToolsStats(teamId)
      return data
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch MCP tools stats'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  return {
    isLoading,
    error,
    fetchStats,
  }
})
