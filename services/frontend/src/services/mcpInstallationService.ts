import { getEnv } from '@/utils/env'
import type {
  McpInstallation,
  InstallServerRequest,
  UserConfiguration,
  CreateUserConfigRequest,
  UpdateUserConfigRequest
} from '@/types/mcp-installations'

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
   * Get SSE stream URL for team's MCP installations
   */
  static getStreamUrl(teamId: string): string {
    return `${this.baseUrl}/api/teams/${teamId}/mcp/installations/stream`
  }

  /**
   * Get a specific MCP installation by ID
   */
  static async getInstallationById(teamId: string, installationId: string): Promise<McpInstallation> {
    const response = await fetch(`${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to fetch MCP installation: ${response.status}`)
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
      throw new Error(errorData.error || errorData.message || `Failed to install MCP server: ${response.status}`)
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
   * Update team arguments for an installation
   */
  static async updateTeamArgs(
    teamId: string,
    installationId: string,
    teamArgs: string[]
  ): Promise<McpInstallation> {
    const response = await fetch(`${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/args`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        args: teamArgs
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to update team arguments: ${response.status}`)
    }

    const data = await response.json()
    return data.data || data
  }

  /**
   * Update team environment variables for an installation
   */
  static async updateTeamEnv(
    teamId: string,
    installationId: string,
    teamEnv: Record<string, string>
  ): Promise<McpInstallation> {
    const response = await fetch(`${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/environment-variables`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        team_env: teamEnv
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to update team environment variables: ${response.status}`)
    }

    const data = await response.json()
    return data.data || data
  }

  /**
   * Update team headers for an installation
   */
  static async updateTeamHeaders(
    teamId: string,
    installationId: string,
    teamHeaders: Record<string, string>
  ): Promise<McpInstallation> {
    const response = await fetch(`${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/headers`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        team_headers: teamHeaders
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to update team headers: ${response.status}`)
    }

    const data = await response.json()
    return data.data || data
  }

  /**
   * Update team-level URL query parameters for an MCP installation
   */
  static async updateTeamQueryParams(
    teamId: string,
    installationId: string,
    teamQueryParams: Record<string, string>
  ): Promise<McpInstallation> {
    const response = await fetch(`${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/query-params`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        team_url_query_params: teamQueryParams
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to update team query parameters: ${response.status}`)
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

  /**
   * Reset the connection token for the current user's instance
   */
  static async resetToken(
    teamId: string,
    installationId: string
  ): Promise<{ instance_token: string }> {
    const response = await fetch(
      `${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/reset-token`,
      {
        method: 'POST',
        credentials: 'include',
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to reset token: ${response.status}`)
    }

    const data = await response.json()
    return data.data
  }

  /**
   * Trigger reconnection for an offline/error HTTP/SSE MCP server
   */
  static async reconnect(
    teamId: string,
    installationId: string
  ): Promise<{
    status: 'recovering' | 'still_offline'
    message: string
    health_check?: { error?: string; responseTimeMs?: number }
  }> {
    const response = await fetch(
      `${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/reconnect`,
      {
        method: 'POST',
        credentials: 'include',
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to reconnect: ${response.status}`)
    }

    const data = await response.json()
    return data.data
  }

  // ==============================
  // USER CONFIGURATION METHODS
  // ==============================

  /**
   * Get all user configurations for an installation
   */
  static async getUserConfigurations(
    teamId: string,
    installationId: string
  ): Promise<UserConfiguration[]> {
    const response = await fetch(
      `${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/user-configs`,
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
      throw new Error(errorData.message || `Failed to get user configurations: ${response.status}`)
    }

    const data = await response.json()
    return data.data || []
  }

  /**
   * Get a specific user configuration by ID
   */
  static async getUserConfigurationById(
    teamId: string,
    installationId: string,
    configId: string
  ): Promise<UserConfiguration> {
    const response = await fetch(
      `${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/user-configs/${configId}`,
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
      throw new Error(errorData.message || `Failed to get user configuration: ${response.status}`)
    }

    const data = await response.json()
    return data.data
  }

  /**
   * Create a new user configuration
   */
  static async createUserConfiguration(
    teamId: string,
    installationId: string,
    configData: CreateUserConfigRequest
  ): Promise<UserConfiguration> {
    const response = await fetch(
      `${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/user-configs`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configData),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to create user configuration: ${response.status}`)
    }

    const data = await response.json()
    return data.data
  }

  /**
   * Update an existing user configuration
   */
  static async updateUserConfiguration(
    teamId: string,
    installationId: string,
    configId: string,
    configData: UpdateUserConfigRequest
  ): Promise<UserConfiguration> {
    const response = await fetch(
      `${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/user-configs/${configId}`,
      {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configData),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to update user configuration: ${response.status}`)
    }

    const data = await response.json()
    return data.data
  }

  /**
   * Update user configuration headers
   */
  static async updateUserHeaders(
    teamId: string,
    installationId: string,
    configId: string,
    headers: Record<string, string>
  ): Promise<UserConfiguration> {
    const response = await fetch(
      `${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/user-configs/${configId}/headers`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ headers }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to update user headers: ${response.status}`)
    }

    const data = await response.json()
    return data.data
  }

  /**
   * Update user configuration URL query parameters
   */
  static async updateUserQueryParams(
    teamId: string,
    installationId: string,
    configId: string,
    queryParams: Record<string, string>
  ): Promise<UserConfiguration> {
    const response = await fetch(
      `${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/user-configs/${configId}/query-params`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query_params: queryParams }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to update user query parameters: ${response.status}`)
    }

    const data = await response.json()
    return data.data
  }

  /**
   * Delete a user configuration
   */
  static async deleteUserConfiguration(
    teamId: string,
    installationId: string,
    configId: string
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/user-configs/${configId}`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to delete user configuration: ${response.status}`)
    }
  }

  /**
   * Add or remove a config schema item (env var or arg) for GitHub-deployed servers
   */
  static async updateConfigSchema(
    teamId: string,
    installationId: string,
    payload: {
      action: 'add' | 'remove'
      config_type: 'env' | 'args'
      item?: {
        name: string
        type: 'string' | 'secret' | 'boolean'
        description?: string
        required?: boolean
        value?: string
      }
      item_name?: string
    }
  ): Promise<McpInstallation> {
    const response = await fetch(
      `${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/config-schema`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || errorData.message || `Failed to update config schema: ${response.status}`)
    }

    const data = await response.json()
    return data.data || data
  }

  // ==============================
  // OAUTH AUTHORIZATION METHODS
  // ==============================

  /**
   * Start OAuth authorization flow for an MCP server
   */
  static async startOAuthAuthorization(
    teamId: string,
    authorizationData: {
      server_id: string
      installation_name: string
      team_args?: string[]
      team_env?: Record<string, string>
    }
  ): Promise<{
    flow_id: string
    authorization_url: string
    requires_authorization: boolean
  }> {
    const response = await fetch(
      `${this.baseUrl}/api/teams/${teamId}/mcp/installations/authorize`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(authorizationData),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || errorData.message || `Failed to start OAuth authorization: ${response.status}`)
    }

    const data = await response.json()
    return data
  }

  /**
   * Start OAuth re-authentication for existing installation
   *
   * Used when installation status is 'requires_reauth' due to expired/invalid tokens.
   * Initiates OAuth flow that updates existing installation instead of creating new one.
   *
   * @param teamId - Team ID
   * @param installationId - Installation ID to re-authenticate
   * @returns OAuth authorization flow data
   */
  static async startReAuth(
    teamId: string,
    installationId: string
  ): Promise<{
    flow_id: string
    authorization_url: string
    requires_authorization: boolean
    expires_at: string
  }> {
    const response = await fetch(
      `${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/reauth`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      // Try to extract error message from response
      let errorMessage = 'Failed to start re-authentication'
      try {
        const errorData = await response.json()
        if (errorData.error) {
          errorMessage = errorData.error
        }
      } catch {
        // Use default error message if JSON parsing fails
      }

      throw new Error(errorMessage)
    }

    const data = await response.json()
    return data
  }
}
