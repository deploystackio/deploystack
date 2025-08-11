import type { FastifyInstance } from 'fastify';
import { UserService } from '../../services/userService';
import { TeamService } from '../../services/teamService';
import { requireOwnershipOrAdmin, getUserIdFromParams } from '../../middleware/roleMiddleware';
import { 
  ERROR_RESPONSE_SCHEMA, 
  PARAMS_WITH_ID_SCHEMA,
  type ErrorResponse,
  type ParamsWithId
} from './schemas';

// Route-specific Schema Constants

const USER_TEAMS_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean',
      description: 'Indicates if the operation was successful'
    },
    teams: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Team ID' },
          name: { type: 'string', description: 'Team name' },
          slug: { type: 'string', description: 'Team slug' },
          description: { type: 'string', nullable: true, description: 'Team description' },
          owner_id: { type: 'string', description: 'Team owner ID' },
          is_default: { type: 'boolean', description: 'Whether this is the default team' },
          created_at: { type: 'string', format: 'date-time', description: 'Team creation date' },
          updated_at: { type: 'string', format: 'date-time', description: 'Team last update date' },
          role: { type: 'string', enum: ['team_admin', 'team_user'], description: 'User role in the team' },
          is_owner: { type: 'boolean', description: 'Whether the user is the owner of this team' }
        },
        required: ['id', 'name', 'slug', 'owner_id', 'created_at', 'updated_at', 'role', 'is_owner']
      },
      description: 'Array of user teams'
    }
  },
  required: ['success', 'teams']
} as const;

// TypeScript interfaces for route-specific types

interface UserTeam {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  owner_id: string;
  is_default?: boolean;
  created_at: string;
  updated_at: string;
  role: 'team_admin' | 'team_user';
  is_owner: boolean;
}

interface UserTeamsSuccessResponse {
  success: boolean;
  teams: UserTeam[];
}


export default async function getUserTeamsRoute(server: FastifyInstance) {
  const userService = new UserService();

  // GET /users/:id/teams - Get teams for specific user (admin only)
  server.get('/users/:id/teams', {
    preValidation: requireOwnershipOrAdmin(getUserIdFromParams),
    schema: {
      tags: ['Users'],
      summary: 'Get user teams by ID',
      description: 'Retrieves all teams for a specific user. Requires admin permissions to view other users\' teams.',
      security: [{ cookieAuth: [] }],
      
      params: PARAMS_WITH_ID_SCHEMA,
      
      response: {
        200: {
          ...USER_TEAMS_SUCCESS_RESPONSE_SCHEMA,
          description: 'User teams retrieved successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Not Found - User not found'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    },
  }, async (request, reply) => {
    try {
      // TypeScript type assertion (Fastify has already validated)
      const { id } = request.params as ParamsWithId;
      
      // Check if user exists
      const targetUser = await userService.getUserById(id);
      if (!targetUser) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'User not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const teams = await TeamService.getUserTeams(id);
      
      // Add role information to each team
      const teamsWithRoles: UserTeam[] = await Promise.all(
        teams.map(async (team) => {
          const membership = await TeamService.getTeamMembership(team.id, id);
          return {
            id: team.id,
            name: team.name,
            slug: team.slug,
            description: team.description,
            owner_id: team.owner_id,
            is_default: team.is_default,
            created_at: team.created_at instanceof Date ? team.created_at.toISOString() : team.created_at,
            updated_at: team.updated_at instanceof Date ? team.updated_at.toISOString() : team.updated_at,
            role: membership?.role || 'team_user' as 'team_admin' | 'team_user',
            is_owner: team.owner_id === id
          };
        })
      );
      
      const successResponse: UserTeamsSuccessResponse = {
        success: true,
        teams: teamsWithRoles
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error fetching user teams');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch user teams'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
