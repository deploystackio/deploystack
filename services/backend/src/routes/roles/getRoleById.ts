import type { FastifyInstance } from 'fastify';
import { RoleService } from '../../services/roleService';
import { requirePermission } from '../../middleware/roleMiddleware';
import { 
  ROLE_ID_PARAMS_SCHEMA,
  ROLE_SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type RoleParams,
  type RoleSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function getRoleByIdRoute(server: FastifyInstance) {
  const roleService = new RoleService();

  // GET /roles/:id - Get role by ID
  server.get('/roles/:id', {
    preValidation: requirePermission('roles.manage'), // ✅ Authorization BEFORE validation
    schema: {
      tags: ['Roles'],
      summary: 'Get role by ID',
      description: 'Retrieves a specific role by its ID. Requires role management permissions.',
      security: [{ cookieAuth: [] }],
      
      // Fastify validation schema
      params: ROLE_ID_PARAMS_SCHEMA,
      
      response: {
        200: {
          ...ROLE_SUCCESS_RESPONSE_SCHEMA,
          description: 'Role data retrieved successfully'
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
          description: 'Not Found - Role not found'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      // TypeScript type assertion (Fastify has already validated)
      const { id } = request.params as RoleParams;
      
      const role = await roleService.getRoleById(id);
      
      if (!role) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Role not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const successResponse: RoleSuccessResponse = {
        success: true,
        data: {
          ...role,
          created_at: role.created_at.toISOString(),
          updated_at: role.updated_at.toISOString()
        }
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error fetching role');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch role'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
