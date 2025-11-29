import { getEnv } from '@/utils/env'
import { z } from 'zod'

// Zod schemas for validation
export const TeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  owner_id: z.string(),
  is_default: z.boolean(),
  non_http_mcp_limit: z.number(),
  mcp_server_limit: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  role: z.enum(['team_admin', 'team_user']).optional(),
  is_admin: z.boolean().optional(),
  is_owner: z.boolean().optional(),
  member_count: z.number().optional()
})

export const TeamWithRoleSchema = TeamSchema.extend({
  role: z.enum(['team_admin', 'team_user'])
})

export const CreateTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100, 'Team name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional()
})

// Type exports
export type Team = z.infer<typeof TeamSchema>
export type TeamWithRole = z.infer<typeof TeamWithRoleSchema>
export type CreateTeamInput = z.infer<typeof CreateTeamSchema>

export interface TeamUsageLimits {
  mcp_server_limit: number;
  non_http_mcp_limit: number;
}

export interface TeamUsageData {
  is_default_team: boolean;
  total_installed_mcp_servers: number;
  non_http_mcp_servers: number;
  http_mcp_servers: number;
  limits: TeamUsageLimits;
}

export interface TeamResponse {
  success: boolean;
  teams: Team[]; // For /api/users/me/teams endpoint
}

export interface TeamsListResponse {
  success: boolean;
  data: TeamWithRole[]; // For /api/teams/me endpoint
}

export interface TeamCreateResponse {
  success: boolean;
  data: Team;
  message?: string;
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
   * Get user teams with role information for the Teams page
   */
  static async getUserTeamsWithRoles(): Promise<TeamWithRole[]> {
    try {
      const apiUrl = this.getApiUrl()

      const response = await fetch(`${apiUrl}/api/teams/me`, {
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

      const data: TeamsListResponse = await response.json()

      if (data.success && Array.isArray(data.data)) {
        return data.data
      } else {
        throw new Error('Invalid response format')
      }
    } catch (error) {
      console.error('Error fetching user teams with roles:', error)
      throw error
    }
  }

  /**
   * Create a new team with Zod validation - clears cache to ensure fresh data
   */
  static async createTeam(teamData: CreateTeamInput): Promise<Team> {
    try {
      // Validate input data with Zod
      const validatedData = CreateTeamSchema.parse(teamData);

      const apiUrl = this.getApiUrl();

      const response = await fetch(`${apiUrl}/api/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(validatedData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 400 && errorData.error?.includes('limit')) {
          throw new Error('You have reached the maximum limit of 3 teams');
        }

        if (response.status === 403) {
          throw new Error('You do not have permission to create teams');
        }

        throw new Error(errorData.error || `Failed to create team: ${response.status}`);
      }

      const data: TeamCreateResponse = await response.json();

      if (!data.success || !data.data) {
        throw new Error('Invalid response format from server');
      }

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

  /**
   * Get user's default team
   */
  static async getUserDefaultTeam(): Promise<Team> {
    try {
      const apiUrl = this.getApiUrl()

      const response = await fetch(`${apiUrl}/api/teams/me/default`, {
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
          throw new Error('No default team found')
        }
        throw new Error(`Failed to fetch default team: ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.data) {
        return data.data
      } else {
        throw new Error('Invalid response format')
      }
    } catch (error) {
      console.error('Error fetching default team:', error)
      throw error
    }
  }

  /**
   * Get team by ID as global admin
   */
  static async getTeamAsAdmin(teamId: string): Promise<Team> {
    try {
      const apiUrl = this.getApiUrl()

      const response = await fetch(`${apiUrl}/api/admin/teams/${teamId}`, {
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
        if (response.status === 403) {
          throw new Error('Forbidden - Global admin access required')
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
      console.error('Error fetching team as admin:', error)
      throw error
    }
  }

  /**
   * Update team as global admin
   */
  static async updateTeamAsAdmin(teamId: string, teamData: { name?: string; description?: string | null; non_http_mcp_limit?: number; mcp_server_limit?: number }): Promise<Team> {
    try {
      const apiUrl = this.getApiUrl()

      const response = await fetch(`${apiUrl}/api/admin/teams/${teamId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(teamData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 401) {
          throw new Error('Unauthorized - please log in')
        }
        if (response.status === 403) {
          throw new Error('Forbidden - Global admin access required')
        }
        if (response.status === 404) {
          throw new Error('Team not found')
        }
        throw new Error(errorData.error || `Failed to update team: ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.data) {
        return data.data
      } else {
        throw new Error('Invalid response format')
      }
    } catch (error) {
      console.error('Error updating team as admin:', error)
      throw error
    }
  }

  /**
   * Get team usage statistics
   */
  static async getTeamUsage(teamId: string): Promise<TeamUsageData> {
    try {
      const apiUrl = this.getApiUrl()

      const response = await fetch(`${apiUrl}/api/teams/${teamId}/usage`, {
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
        if (response.status === 403) {
          throw new Error('You do not have permission to view this team\'s usage')
        }
        if (response.status === 404) {
          throw new Error('Team not found')
        }
        throw new Error(`Failed to fetch team usage: ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.data) {
        return data.data
      } else {
        throw new Error('Invalid response format')
      }
    } catch (error) {
      console.error('Error fetching team usage:', error)
      throw error
    }
  }
}
