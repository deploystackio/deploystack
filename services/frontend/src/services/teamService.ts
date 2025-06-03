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
  success: boolean;
  teams: Team[]; // Changed 'data' to 'teams'
}

interface TeamCacheEntry {
  data: Team[];
  timestamp: number;
}

export class TeamService {
  private static userTeamsCache: TeamCacheEntry | null = null;
  private static readonly CACHE_DURATION = 30000; // 30 seconds
  private static pendingUserTeamsRequest: Promise<Team[]> | null = null;

  private static getApiUrl(): string {
    const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL') // Corrected key
    if (!apiUrl) {
      throw new Error('API URL not configured. Make sure VITE_DEPLOYSTACK_BACKEND_URL is set.')
    }
    return apiUrl
  }

  /**
   * Clear the teams cache - call this when teams data might have changed
   */
  static clearUserTeamsCache(): void {
    this.userTeamsCache = null;
    this.pendingUserTeamsRequest = null;
  }

  /**
   * Check if cached teams data is still valid
   */
  private static isUserTeamsCacheValid(): boolean {
    if (!this.userTeamsCache) return false;
    return Date.now() - this.userTeamsCache.timestamp < this.CACHE_DURATION;
  }

  /**
   * Get user teams with smart caching to prevent duplicate API calls
   * @param forceRefresh - Force a fresh API call, bypassing cache
   */
  static async getUserTeams(forceRefresh = false): Promise<Team[]> {
    // If force refresh is requested, clear cache first
    if (forceRefresh) {
      this.clearUserTeamsCache();
    }

    // Return cached data if valid
    if (!forceRefresh && this.isUserTeamsCacheValid() && this.userTeamsCache) {
      return this.userTeamsCache.data;
    }

    // If there's already a pending request, return it to prevent duplicate calls
    if (this.pendingUserTeamsRequest) {
      return this.pendingUserTeamsRequest;
    }

    // Make the API call
    this.pendingUserTeamsRequest = this.fetchUserTeams();

    try {
      const result = await this.pendingUserTeamsRequest;

      // Cache the result
      this.userTeamsCache = {
        data: result,
        timestamp: Date.now()
      };

      return result;
    } finally {
      // Clear pending request
      this.pendingUserTeamsRequest = null;
    }
  }

  /**
   * Internal method to fetch user teams from API
   */
  private static async fetchUserTeams(): Promise<Team[]> {
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

      if (data.success && Array.isArray(data.teams)) { // Changed 'data.data' to 'data.teams'
        return data.teams // Changed 'data.data' to 'data.teams'
      } else {
        throw new Error('Invalid response format')
      }
    } catch (error) {
      console.error('Error fetching user teams:', error)
      throw error
    }
  }

  /**
   * Create a new team - clears cache to ensure fresh data
   */
  static async createTeam(teamData: Partial<Team>): Promise<Team> {
    try {
      const apiUrl = this.getApiUrl();

      const response = await fetch(`${apiUrl}/api/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(teamData),
      });

      if (!response.ok) {
        throw new Error(`Failed to create team: ${response.status}`);
      }

      const data = await response.json();

      // Clear cache on successful team creation
      this.clearUserTeamsCache();

      return data.data;
    } catch (error) {
      console.error('Error creating team:', error);
      throw error;
    }
  }

  /**
   * Update a team - clears cache to ensure fresh data
   */
  static async updateTeam(teamId: string, teamData: Partial<Team>): Promise<Team> {
    try {
      const apiUrl = this.getApiUrl();

      const response = await fetch(`${apiUrl}/api/teams/${teamId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(teamData),
      });

      if (!response.ok) {
        throw new Error(`Failed to update team: ${response.status}`);
      }

      const data = await response.json();

      // Clear cache on successful team update
      this.clearUserTeamsCache();

      return data.data;
    } catch (error) {
      console.error('Error updating team:', error);
      throw error;
    }
  }

  /**
   * Delete a team - clears cache to ensure fresh data
   */
  static async deleteTeam(teamId: string): Promise<void> {
    try {
      const apiUrl = this.getApiUrl();

      const response = await fetch(`${apiUrl}/api/teams/${teamId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete team: ${response.status}`);
      }

      // Clear cache on successful team deletion
      this.clearUserTeamsCache();
    } catch (error) {
      console.error('Error deleting team:', error);
      throw error;
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
