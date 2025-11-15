import { defineStore } from 'pinia'
import { ref } from 'vue'
import { McpToolsService } from '@/services/mcpToolsService'
import type { InstallationToolsResponse, TeamToolsSummaryResponse } from '@/services/mcpToolsService'

export const useMcpToolsStore = defineStore('mcpTools', () => {
  // State - only for loading/error tracking, no caching
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Actions - always fetch fresh data from backend
  async function fetchInstallationTools(
    teamId: string,
    installationId: string
  ): Promise<InstallationToolsResponse> {
    isLoading.value = true
    error.value = null

    try {
      const response = await McpToolsService.getInstallationTools(teamId, installationId)
      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch installation tools'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function fetchTeamSummary(teamId: string): Promise<TeamToolsSummaryResponse> {
    isLoading.value = true
    error.value = null

    try {
      const response = await McpToolsService.getTeamToolsSummary(teamId)
      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch team tools summary'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  function clearError(): void {
    error.value = null
  }

  return {
    // State
    isLoading,
    error,

    // Actions
    fetchInstallationTools,
    fetchTeamSummary,
    clearError,
  }
})
