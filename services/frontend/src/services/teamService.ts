import { getEnv } from '@/utils/env'

export interface Team {
  id: string
  name: string
  slug: string
  description?: string
  owner_id: string
  created_at: number
  updated_at: number
}

export interface TeamResponse {
  success: boolean
  data: Team[]
}

export class TeamService {
  private static getApiUrl(): string {
    const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL') // Corrected key
    if (!apiUrl) {
      throw new Error('API URL not configured. Make sure VITE_DEPLOYSTACK_BACKEND_URL is set.')
    }
    return apiUrl
  }

  static async getUserTeams(): Promise<Team[]> {
    try {
      const apiUrl = this.getApiUrl()

      const response = await fetch(`${apiUrl}/api/users/me/teams`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - please log in')
        }
        throw new Error(`Failed to fetch teams: ${response.status}`)
      }

      const data: TeamResponse = await response.json()

      if (data.success && Array.isArray(data.data)) {
        return data.data
      } else {
        throw new Error('Invalid response format')
      }
    } catch (error) {
      console.error('Error fetching user teams:', error)
      throw error
    }
  }

  static async getTeamById(teamId: string): Promise<Team> {
    try {
      const apiUrl = this.getApiUrl()

      const response = await fetch(`${apiUrl}/api/teams/${teamId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - please log in')
        }
        if (response.status === 404) {
          throw new Error('Team not found')
        }
        throw new Error(`Failed to fetch team: ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.data) {
        return data.data
      } else {
        throw new Error('Invalid response format')
      }
    } catch (error) {
      console.error('Error fetching team:', error)
      throw error
    }
  }
}
