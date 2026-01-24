import { getEnv } from '@/utils/env'

export interface Repository {
  id: number
  name: string
  full_name: string
  owner: string
  description: string | null
  url: string
  clone_url: string
  default_branch: string
  private: boolean
  updated_at: string
}

export interface DeploymentParams {
  repository_url: string
  branch: string
  satellite_id: string
  team_env?: Record<string, string>
  template_args?: string[]
}

export interface Branch {
  name: string
  commit_sha: string
  protected: boolean
}

export interface BranchesResponse {
  branches: Branch[]
  default_branch: string
}

export interface DeployedServer {
  id: string
  name: string
  repository_url: string
  git_branch: string
  git_commit_sha: string
  installation_id: string
  created_at: string
  status: string
}

export class DeploymentService {
  private static baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

  /**
   * Check if GitHub is connected for the team
   */
  static async checkConnection(teamId: string): Promise<{ connected: boolean }> {
    const response = await fetch(
      `${this.baseUrl}/api/teams/${teamId}/deploy/github/connection`,
      {
        method: 'GET',
        credentials: 'include'
      }
    )

    if (!response.ok) {
      // Try to parse error message from backend
      try {
        const errorData = await response.json()
        if (errorData.error) {
          // Throw with the backend error message
          throw new Error(errorData.error)
        }
      } catch (parseError) {
        // If parseError is already our Error with backend message, re-throw it
        if (parseError instanceof Error && parseError.message.includes('not enabled')) {
          throw parseError
        }
        // Otherwise use generic error
      }
      throw new Error('Failed to check GitHub connection')
    }

    return response.json()
  }

  /**
   * Get list of repositories from GitHub
   */
  static async getRepositories(teamId: string): Promise<Repository[]> {
    const response = await fetch(
      `${this.baseUrl}/api/teams/${teamId}/deploy/github/repositories`,
      {
        method: 'GET',
        credentials: 'include'
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch repositories')
    }

    const data = await response.json()
    return data.repositories
  }

  /**
   * Get branches for a specific repository
   */
  static async getBranches(
    teamId: string,
    owner: string,
    repo: string
  ): Promise<BranchesResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/teams/${teamId}/deploy/github/repositories/${owner}/${repo}/branches`,
      {
        method: 'GET',
        credentials: 'include'
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to fetch branches')
    }

    return response.json()
  }

  /**
   * Create a new deployment (synchronous - returns installation_id)
   */
  static async createDeployment(
    teamId: string,
    params: DeploymentParams
  ): Promise<{ installation_id: string; server_id: string; commit_sha: string }> {
    const response = await fetch(
      `${this.baseUrl}/api/teams/${teamId}/deploy`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          source: 'github',
          repository_url: params.repository_url,
          branch: params.branch,
          team_env: params.team_env || {},
          template_args: params.template_args || []
        })
      }
    )

    if (!response.ok) {
      // Parse error message from backend for validation errors
      try {
        const errorData = await response.json()
        if (errorData.error) {
          throw new Error(errorData.error)
        }
      } catch (parseError) {
        if (parseError instanceof Error) {
          throw parseError
        }
      }
      throw new Error('Failed to create deployment')
    }

    const result = await response.json()
    return result.data // Backend returns { success: true, data: { installation_id, server_id, commit_sha } }
  }

  /**
   * Get team deployments (from deployment history)
   */
  static async getTeamDeployments(teamId: string): Promise<DeployedServer[]> {
    const response = await fetch(
      `${this.baseUrl}/api/teams/${teamId}/deploy/history`,
      {
        method: 'GET',
        credentials: 'include'
      }
    )

    if (!response.ok) {
      // Try to parse error message from backend
      try {
        const errorData = await response.json()
        if (errorData.error) {
          // Preserve the exact error message from backend
          throw new Error(errorData.error)
        }
      } catch (parseError) {
        // If JSON parsing fails, continue to generic error
        if (parseError instanceof Error && parseError.message.includes('not enabled')) {
          throw parseError
        }
      }
      throw new Error('Failed to fetch deployments')
    }

    const data = await response.json()
    return data.deployments || []
  }
}
