import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RoleService } from '../../services/roleService';
import { requirePermission } from '../../middleware/roleMiddleware';
import { 
  ROLES_LIST_SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type RolesListSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function listRolesRoute(server: FastifyInstance) {
  const roleService = new RoleService();

  // GET /roles - List all roles
  server.get('/roles', {
    schema: {
      tags: ['Roles'],
      summary: 'List all roles',
      description: 'Retrieves a list of all roles in the system. Requires role management permissions.',
      security: [{ cookieAuth: [] }],
      response: {
        200: {
          ...ROLES_LIST_SUCCESS_RESPONSE_SCHEMA,
          description: 'Successfully retrieved roles list'
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
    },
    preValidation: requirePermission('roles.manage')
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const roles = await roleService.getAllRoles();
      const response: RolesListSuccessResponse = {
        success: true,
        data: roles.map(role => ({
          ...role,
          created_at: role.created_at.toISOString(),
          updated_at: role.updated_at.toISOString()
        }))
      };
      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error fetching roles');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch roles'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
