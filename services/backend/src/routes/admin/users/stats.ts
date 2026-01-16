import type { FastifyInstance } from 'fastify';
import { UserService } from '../../../services/userService';
import { TeamService } from '../../../services/teamService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import {
  ERROR_RESPONSE_SCHEMA,
  USER_STATS_RESPONSE_SCHEMA,
  type ErrorResponse,
  type UserStatsResponse
} from './schemas';

export default async function getUserStatsAdminRoute(server: FastifyInstance) {
  const userService = new UserService();

  // GET /admin/users/stats - Get user statistics (Global Admin only)
  server.get('/users/stats', {
    preValidation: requireGlobalAdmin(),
    schema: {
      tags: ['Admin - Users'],
      summary: 'Get user statistics (Global Admin)',
      description: 'Allows global administrators to retrieve comprehensive user and team statistics including counts by role, authentication type, and team types.',
      security: [{ cookieAuth: [] }],

      response: {
        200: {
          ...USER_STATS_RESPONSE_SCHEMA,
          description: 'User statistics retrieved successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Global admin required'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      // Gather all statistics in parallel
      const [
        userCountByRole,
        totalUsers,
        usersByAuthType,
        globalAdminCount,
        defaultTeamCount,
        nonDefaultTeamCount
      ] = await Promise.all([
        userService.getUserCountByRole(),
        userService.getTotalUserCount(),
        userService.getUserCountByAuthType(),
        userService.getGlobalAdminCount(),
        TeamService.getDefaultTeamCount(),
        TeamService.getNonDefaultTeamCount()
      ]);

      // Convert Record<string, number> to array format for user_count_by_role
      const roleCountArray = Object.entries(userCountByRole).map(([role_id, count]) => ({
        role_id,
        count
      }));

      // Create clean response object with proper typing
      const statsResponse: UserStatsResponse = {
        success: true,
        data: {
          user_statistics: {
            total_users: totalUsers,
            users_by_auth_type: {
              email: usersByAuthType['email_signup'] || 0,
              github: usersByAuthType['github'] || 0
            },
            global_admins: globalAdminCount
          },
          team_statistics: {
            default_teams: defaultTeamCount,
            non_default_teams: nonDefaultTeamCount
          },
          user_count_by_role: roleCountArray
        }
      };

      const jsonString = JSON.stringify(statsResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error fetching user statistics in admin route');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch user statistics'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
