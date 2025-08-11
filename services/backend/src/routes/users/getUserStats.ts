import type { FastifyInstance } from 'fastify';
import { UserService } from '../../services/userService';
import { requirePermission } from '../../middleware/roleMiddleware';
import { 
  ERROR_RESPONSE_SCHEMA,
  type ErrorResponse
} from './schemas';

// Route-specific Schema Constants
const ROLE_COUNT_SCHEMA = {
  type: 'object',
  properties: {
    role_id: { 
      type: 'string',
      description: 'Role identifier'
    },
    count: { 
      type: 'number',
      description: 'Number of users with this role'
    }
  },
  required: ['role_id', 'count'],
  additionalProperties: false
} as const;

const USER_STATS_DATA_SCHEMA = {
  type: 'object',
  properties: {
    user_count_by_role: {
      type: 'array',
      items: ROLE_COUNT_SCHEMA,
      description: 'Array of user counts grouped by role'
    }
  },
  required: ['user_count_by_role'],
  additionalProperties: false
} as const;

const USER_STATS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean',
      description: 'Indicates if the operation was successful'
    },
    data: {
      ...USER_STATS_DATA_SCHEMA,
      description: 'User statistics data'
    }
  },
  required: ['success', 'data'],
  additionalProperties: false
} as const;

// TypeScript interfaces for route-specific types
interface RoleCount {
  role_id: string;
  count: number;
}

interface UserStatsData {
  user_count_by_role: RoleCount[];
}

interface UserStatsResponse {
  success: boolean;
  data: UserStatsData;
}


export default async function getUserStatsRoute(server: FastifyInstance) {
  const userService = new UserService();

  server.get('/users/stats', {
    preValidation: requirePermission('users.list'),
    schema: {
      tags: ['Users'],
      summary: 'Get user statistics',
      description: 'Retrieves user statistics including count by role. Requires admin permissions.',
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
          description: 'Forbidden - Insufficient permissions'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userCountByRole = await userService.getUserCountByRole();
      
      // Convert Record<string, number> to array format
      const roleCountArray = Object.entries(userCountByRole).map(([role_id, count]) => ({
        role_id,
        count
      }));
      
      // Create clean response object with proper typing
      const statsResponse: UserStatsResponse = {
        success: true,
        data: {
          user_count_by_role: roleCountArray
        }
      };
      
      const jsonString = JSON.stringify(statsResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error fetching user statistics');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch user statistics'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
