import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TeamService, type TeamMemberWithUser } from '../../../services/teamService';
import { checkUserPermission } from '../../../middleware/roleMiddleware';
import {
  ERROR_RESPONSE_SCHEMA,
  TEAM_ID_PARAMS_SCHEMA,
  type ErrorResponse
} from '../schemas';

// Custom response schema for team members list (using actual service return type)
const TEAM_MEMBERS_WITH_USER_INFO_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates if the operation was successful' },
    data: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Membership ID' },
          user_id: { type: 'string', description: 'User ID' },
          username: { type: 'string', description: 'Username' },
          email: { type: 'string', description: 'User email' },
          first_name: { type: 'string', nullable: true, description: 'User first name' },
          last_name: { type: 'string', nullable: true, description: 'User last name' },
          role: {
            type: 'string',
            enum: ['team_admin', 'team_user'],
            description: 'User role in the team'
          },
          is_admin: { type: 'boolean', description: 'True if user is team admin' },
          is_owner: { type: 'boolean', description: 'True if user is team owner' },
          joined_at: { type: 'string', format: 'date-time', description: 'Date when user joined the team' }
        },
        required: ['id', 'user_id', 'username', 'email', 'role', 'is_admin', 'is_owner', 'joined_at']
      },
      description: 'Array of team members with user information'
    }
  },
  required: ['success', 'data']
} as const;

// TypeScript interface for parameters
interface TeamIdParams {
  id: string;
}

// TypeScript interface for response
interface TeamMembersWithUserInfoResponse {
  success: boolean;
  data: TeamMemberWithUser[];
}

export default async function listTeamMembersRoute(server: FastifyInstance) {
  server.get('/teams/:id/members', {
    // ✅ SECURITY FIRST: No preValidation middleware needed as this has manual permission checks
    // This endpoint has complex authorization logic that needs to check team membership and global permissions
    schema: {
      tags: ['Team Members'],
      summary: 'Get team members',
      description: 'Retrieves all members of a specific team with their user information, roles, and status flags.',
      security: [{ cookieAuth: [] }],
      
      // Parameter validation
      params: TEAM_ID_PARAMS_SCHEMA,
      
      response: {
        200: {
          ...TEAM_MEMBERS_WITH_USER_INFO_RESPONSE_SCHEMA,
          description: 'Team members retrieved successfully'
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
          description: 'Not Found - Team not found'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: TeamIdParams }>, reply: FastifyReply) => {
    try {
      if (!request.user) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Authentication required'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(401).type('application/json').send(jsonString);
      }

      // TypeScript type assertion (Fastify has already validated)
      const { id: teamId } = request.params as TeamIdParams;

      // Check if team exists
      const team = await TeamService.getTeamById(teamId);
      if (!team) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Team not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Check if user has access to view team members
      const isTeamMember = await TeamService.isTeamMember(teamId, request.user.id);
      const hasGlobalPermission = await checkUserPermission(request.user.id, 'team.members.view');
      
      if (!isTeamMember && !hasGlobalPermission) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'You do not have permission to view this team\'s members'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      const members = await TeamService.getTeamMembersWithUserInfo(teamId);

      const successResponse: TeamMembersWithUserInfoResponse = {
        success: true,
        data: members
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error fetching team members');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch team members'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
