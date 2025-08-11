import type { FastifyInstance } from 'fastify';
import { RoleService } from '../../services/roleService';
import { requirePermission } from '../../middleware/roleMiddleware';
import { 
  ROLE_ID_PARAMS_SCHEMA,
  SUCCESS_MESSAGE_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  type RoleParams,
  type SuccessMessageResponse,
  type ErrorResponse
} from './schemas';

export default async function deleteRoleRoute(server: FastifyInstance) {
  const roleService = new RoleService();

  // DELETE /roles/:id - Delete role
  server.delete('/roles/:id', {
    preValidation: requirePermission('roles.manage'), // ✅ Authorization BEFORE validation
    schema: {
      tags: ['Roles'],
      summary: 'Delete role',
      description: 'Deletes a role from the system. System roles and roles assigned to users cannot be deleted. Requires role management permissions.',
      security: [{ cookieAuth: [] }],
      
      // Fastify validation schema
      params: ROLE_ID_PARAMS_SCHEMA,
      
      response: {
        200: {
          ...SUCCESS_MESSAGE_RESPONSE_SCHEMA,
          description: 'Role deleted successfully'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions or cannot delete system roles'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Not Found - Role not found'
        },
        409: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Conflict - Cannot delete role that is assigned to users'
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
      
      const success = await roleService.deleteRole(id);
      
      if (!success) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Role not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const successResponse: SuccessMessageResponse = {
        success: true,
        message: 'Role deleted successfully'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Cannot delete system roles') {
          const errorResponse: ErrorResponse = {
            success: false,
            error: 'Cannot delete system roles'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(403).type('application/json').send(jsonString);
        }
        
        if (error.message === 'Cannot delete role that is assigned to users') {
          const errorResponse: ErrorResponse = {
            success: false,
            error: 'Cannot delete role that is assigned to users'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(409).type('application/json').send(jsonString);
        }
      }
      
      server.log.error(error, 'Error deleting role');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to delete role'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
