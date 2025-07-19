import { getEnv } from '@/utils/env'
import type { McpInstallation, InstallServerRequest } from '@/types/mcp-installations'

export class McpInstallationService {
  private static baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

  /**
   * Get team's MCP server installations
   */
  static async getTeamInstallations(teamId: string): Promise<McpInstallation[]> {
    const response = await fetch(`${this.baseUrl}/api/teams/${teamId}/mcp/installations`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to fetch MCP installations: ${response.status}`)
    }

    const data = await response.json()
    return data.data || data
  }

  /**
   * Install MCP server for team
   */
  static async installServer(teamId: string, installData: InstallServerRequest): Promise<McpInstallation> {
    const response = await fetch(`${this.baseUrl}/api/teams/${teamId}/mcp/installations`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(installData),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to install MCP server: ${response.status}`)
    }

    const data = await response.json()
    return data.data || data
  }

  /**
   * Create MCP server installation with proper team context
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async createInstallation(teamId: string, installData: any): Promise<{ success: boolean; data: any; message?: string }> {
    try {
      const result = await this.installServer(teamId, installData)
      return {
        success: true,
        data: result
      }
    } catch (error) {
      return {
        success: false,
        data: null,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Remove MCP server installation
   */
  static async removeInstallation(teamId: string, installationId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to remove MCP installation: ${response.status}`)
    }
  }

  /**
   * Update environment variables for an installation
   */
  static async updateEnvironmentVariables(
    teamId: string,
    installationId: string,
    envVars: Record<string, string>
  ): Promise<McpInstallation> {
    const response = await fetch(`${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_environment_variables: envVars
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to update environment variables: ${response.status}`)
    }

    const data = await response.json()
    return data.data || data
  }

  /**
   * Get installation configuration for a specific client (claude-desktop, vscode, cursor)
   */
  static async getInstallationConfig(
    teamId: string,
    installationId: string,
    clientType: 'claude-desktop' | 'vscode' | 'cursor'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/config/${clientType}`,
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
      throw new Error(errorData.message || `Failed to get installation config: ${response.status}`)
    }

    const data = await response.json()
    return data.data || data
  }
}
