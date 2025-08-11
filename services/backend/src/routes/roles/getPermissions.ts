import type { FastifyInstance } from 'fastify';
import { RoleService } from '../../services/roleService';
import { requirePermission } from '../../middleware/roleMiddleware';
import { 
  PERMISSIONS_SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  AVAILABLE_PERMISSIONS,
  type PermissionsSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function getPermissionsRoute(server: FastifyInstance) {
  // GET /roles/permissions - Get available permissions
  server.get('/roles/permissions', {
    preValidation: requirePermission('roles.manage'), // ✅ Authorization BEFORE validation
    schema: {
      tags: ['Roles'],
      summary: 'Get available permissions',
      description: 'Retrieves all available permissions and default role configurations. Requires role management permissions.',
      security: [{ cookieAuth: [] }],
      
      response: {
        200: {
          ...PERMISSIONS_SUCCESS_RESPONSE_SCHEMA,
          description: 'Available permissions and default roles retrieved successfully'
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
      const successResponse: PermissionsSuccessResponse = {
        success: true,
        data: {
          permissions: AVAILABLE_PERMISSIONS,
          default_roles: RoleService.getDefaultPermissions()
        }
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error fetching permissions');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch permissions'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
