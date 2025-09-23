// Satellite Registration Token Service
import { getEnv } from '@/utils/env'

// Types
export interface RegistrationToken {
  id: string
  token: string
  token_type: 'global' | 'team'
  team_id: string | null
  team_slug?: string
  created_by: string
  creator_name?: string
  expires_at: string
  created_at: string
  used: boolean
  used_at?: string
  used_by?: string
}

export interface CreateTokenRequest {
  token_type: 'global' | 'team'
  expires_in_hours?: number
  team_id?: string
}

export interface CreateTokenResponse {
  success: boolean
  message?: string
  data: {
    token: RegistrationToken
  }
}

export interface ListTokensResponse {
  success: boolean
  message?: string
  data: {
    tokens: RegistrationToken[]
    pagination?: {
      total: number
      page: number
      pages: number
      limit: number
    }
  }
}

export interface RevokeTokenResponse {
  success: boolean
  message?: string
}

// Service class
export class SatelliteTokenService {
  private static baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL') || ''

  private static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.baseUrl) {
      throw new Error('Backend URL not configured')
    }

    const url = `${this.baseUrl}${endpoint}`

    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Request failed: ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Create a new registration token
   */
  static async createToken(request: CreateTokenRequest): Promise<CreateTokenResponse> {
    let endpoint: string

    if (request.token_type === 'global') {
      endpoint = '/api/satellites/global/registration-tokens'
    } else if (request.token_type === 'team' && request.team_id) {
      endpoint = `/api/teams/${request.team_id}/satellites/registration-tokens`
    } else {
      throw new Error('Invalid token type or missing team ID')
    }

    return await this.request<CreateTokenResponse>(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        expires_in_hours: request.expires_in_hours
      })
    })
  }

  /**
   * List all registration tokens (global and team tokens user has access to)
   */
  static async listTokens(page = 1, limit = 50): Promise<ListTokensResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    })

    return await this.request<ListTokensResponse>(
      `/api/satellites/registration-tokens?${params.toString()}`
    )
  }

  /**
   * List global registration tokens (global admins only)
   */
  static async listGlobalTokens(page = 1, limit = 50): Promise<ListTokensResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    })

    return await this.request<ListTokensResponse>(
      `/api/satellites/global/registration-tokens?${params.toString()}`
    )
  }

  /**
   * List team registration tokens (team admins and global admins)
   */
  static async listTeamTokens(teamId: string, page = 1, limit = 50): Promise<ListTokensResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    })

    return await this.request<ListTokensResponse>(
      `/api/teams/${teamId}/satellites/registration-tokens?${params.toString()}`
    )
  }

  /**
   * Revoke a registration token
   */
  static async revokeToken(tokenId: string): Promise<RevokeTokenResponse> {
    if (!this.baseUrl) {
      throw new Error('Backend URL not configured')
    }

    const url = `${this.baseUrl}/api/satellites/registration-tokens/${tokenId}`

    const response = await fetch(url, {
      method: 'DELETE',
      credentials: 'include',
      // No Content-Type header for DELETE requests without body
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Request failed: ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Get token details by ID
   */
  static async getToken(tokenId: string): Promise<{ success: boolean; data: { token: RegistrationToken } }> {
    return await this.request<{ success: boolean; data: { token: RegistrationToken } }>(
      `/api/satellites/registration-tokens/${tokenId}`
    )
  }
}
