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
    const response = await fetch(`${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        team_args: teamArgs
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
    const response = await fetch(`${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}`, {
      method: 'PUT',
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
}
