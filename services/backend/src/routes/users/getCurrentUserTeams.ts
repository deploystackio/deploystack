import type { FastifyInstance } from 'fastify';
import { TeamService } from '../../services/teamService';
import { requireAuthentication } from '../../middleware/roleMiddleware';
import { 
  ERROR_RESPONSE_SCHEMA, 
  USER_TEAMS_RESPONSE_SCHEMA,
  type ErrorResponse,
  type UserTeamsResponse,
  type TeamItem
} from './schemas';

export default async function getCurrentUserTeamsRoute(server: FastifyInstance) {
  // GET /users/me/teams - Get current user's teams
  server.get('/users/me/teams', {
    preValidation: requireAuthentication(), // ✅ Authorization BEFORE validation
    schema: {
      tags: ['Users'],
      summary: 'Get current user teams',
      description: 'Retrieves all teams that the currently authenticated user belongs to.',
      security: [{ cookieAuth: [] }],
      
      response: {
        200: {
          ...USER_TEAMS_RESPONSE_SCHEMA,
          description: 'User teams retrieved successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      // request.user is guaranteed to exist due to requireAuthentication() middleware
      const userId = request.user!.id;

      const teams = await TeamService.getUserTeams(userId);
      
      // Add role information to each team
      const teamsWithRoles = await Promise.all(
        teams.map(async (team) => {
          const membership = await TeamService.getTeamMembership(team.id, userId);
          return {
            ...team,
            role: membership?.role || 'team_user',
            is_owner: team.owner_id === userId
          };
        })
      );
      
      // Create clean response object to avoid serialization issues
      const cleanTeams: TeamItem[] = teamsWithRoles.map(team => ({
        id: String(team.id),
        name: String(team.name),
        slug: String(team.slug),
        description: team.description ? String(team.description) : null,
        owner_id: String(team.owner_id),
        is_default: Boolean(team.is_default),
        created_at: team.created_at ? team.created_at.toISOString() : null,
        updated_at: team.updated_at ? team.updated_at.toISOString() : null,
        role: String(team.role),
        is_owner: Boolean(team.is_owner),
        allow_remote_mcp: Boolean(team.allow_remote_mcp),
        allow_github_mcp: Boolean(team.allow_github_mcp),
        allow_private_github_repos: Boolean(team.allow_private_github_repos)
      }));

      const successResponse: UserTeamsResponse = {
        success: true,
        teams: cleanTeams
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
