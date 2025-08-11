import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RoleService } from '../../services/roleService';
import { requirePermission } from '../../middleware/roleMiddleware';
import { 
  UPDATE_ROLE_REQUEST_SCHEMA,
  ROLE_ID_PARAMS_SCHEMA,
  ROLE_SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  AVAILABLE_PERMISSIONS,
  type UpdateRoleRequest,
  type RoleParams,
  type RoleSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function updateRoleRoute(server: FastifyInstance) {
  const roleService = new RoleService();

  // PUT /roles/:id - Update role
  server.put('/roles/:id', {
    preValidation: requirePermission('roles.manage'), // ✅ Authorization BEFORE validation
    schema: {
      tags: ['Roles'],
      summary: 'Update role',
      description: 'Updates an existing role. System roles cannot be updated. Requires role management permissions. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      
      // Fastify validation schemas
      params: ROLE_ID_PARAMS_SCHEMA,
      body: UPDATE_ROLE_REQUEST_SCHEMA,
      
      // OpenAPI documentation (same schemas, reused)
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: UPDATE_ROLE_REQUEST_SCHEMA
          }
        }
      },
      
      response: {
        200: {
          ...ROLE_SUCCESS_RESPONSE_SCHEMA,
          description: 'Role updated successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Validation error or invalid permissions'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions or cannot update system roles'
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as RoleParams;
      // TypeScript type assertion (Fastify has already validated)
      const validatedData = request.body as UpdateRoleRequest;
      
      // Validate permissions if provided
      if (validatedData.permissions) {
        const invalidPermissions = validatedData.permissions.filter(
          perm => !AVAILABLE_PERMISSIONS.includes(perm as typeof AVAILABLE_PERMISSIONS[number])
        );
        
        if (invalidPermissions.length > 0) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: 'Invalid permissions',
            details: { invalid_permissions: invalidPermissions }
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }
      }

      const role = await roleService.updateRole(id, validatedData);
      
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
        },
        message: 'Role updated successfully'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      if (error instanceof Error && error.message === 'Cannot update system roles') {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Cannot update system roles'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }
      
      server.log.error(error, 'Error updating role');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to update role'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
