import type { FastifyInstance } from 'fastify';
import { RoleService } from '../../services/roleService';
import { requirePermission } from '../../middleware/roleMiddleware';
import { 
  CREATE_ROLE_REQUEST_SCHEMA,
  ROLE_SUCCESS_RESPONSE_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  AVAILABLE_PERMISSIONS,
  type CreateRoleRequest,
  type RoleSuccessResponse,
  type ErrorResponse
} from './schemas';

export default async function createRoleRoute(server: FastifyInstance) {
  const roleService = new RoleService();

  // POST /roles - Create new role
  server.post('/roles', {
    preValidation: requirePermission('roles.manage'), // ✅ Authorization BEFORE validation
    schema: {
      tags: ['Roles'],
      summary: 'Create new role',
      description: 'Creates a new role with specified permissions. Requires role management permissions. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      
      // Fastify validation schema
      body: CREATE_ROLE_REQUEST_SCHEMA,
      
      // OpenAPI documentation (same schema, reused)
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: CREATE_ROLE_REQUEST_SCHEMA
          }
        }
      },
      
      response: {
        201: {
          ...ROLE_SUCCESS_RESPONSE_SCHEMA,
          description: 'Role created successfully'
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
          description: 'Forbidden - Insufficient permissions'
        },
        409: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Conflict - Role ID or name already exists'
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
      const { id, name, description, permissions } = request.body as CreateRoleRequest;
      
      // Validate permissions against available permissions
      const invalidPermissions = permissions.filter(
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

      const role = await roleService.createRole({ id, name, description, permissions });
      
      const successResponse: RoleSuccessResponse = {
        success: true,
        data: {
          ...role,
          created_at: role.created_at.toISOString(),
          updated_at: role.updated_at.toISOString()
        },
        message: 'Role created successfully'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(201).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error creating role');
      
      if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Role ID or name already exists'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(409).type('application/json').send(jsonString);
      }
      
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to create role'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
