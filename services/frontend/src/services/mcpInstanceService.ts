import { getEnv } from '@/utils/env'
import type { McpInstance, GetInstancesResponse } from '@/types/mcp-instances'

export class McpInstanceService {
  private static baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

  static async getInstallationInstances(
    teamId: string,
    installationId: string
  ): Promise<McpInstance[]> {
    const response = await fetch(
      `${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/instances`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }))
      throw new Error(errorData.error || 'Failed to fetch instances')
    }

    const result: GetInstancesResponse = await response.json()
    return result.data
  }
}
