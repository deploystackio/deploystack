import type { FastifyInstance } from 'fastify';
import { UserService } from '../../services/userService';
import { requirePermission } from '../../middleware/roleMiddleware';
import { 
  ERROR_RESPONSE_SCHEMA, 
  PARAMS_WITH_ID_SCHEMA, 
  ASSIGN_ROLE_REQUEST_SCHEMA,
  type ErrorResponse,
  type ParamsWithId,
  type AssignRoleRequest
} from './schemas';

// Route-specific Schema Constants

const ASSIGN_ROLE_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean',
      description: 'Indicates if the role assignment was successful'
    },
    data: { 
      type: 'object',
      description: 'Updated user data with new role'
    },
    message: { 
      type: 'string',
      description: 'Success message'
    }
  },
  required: ['success', 'data', 'message']
} as const;

// TypeScript interfaces for route-specific types
interface AssignRoleSuccessResponse {
  success: boolean;
  data: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  message: string;
}

export default async function assignRoleRoute(server: FastifyInstance) {
  const userService = new UserService();

  // PUT /users/:id/role - Assign role to user (admin only)
  server.put('/users/:id/role', {
    preValidation: requirePermission('users.edit'), // ✅ Authorization BEFORE validation
    schema: {
      tags: ['Users'],
      summary: 'Assign role to user',
      description: 'Assigns a role to a specific user. Requires admin permissions. Users cannot change their own role. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      
      // Fastify validation schemas
      params: PARAMS_WITH_ID_SCHEMA,
      body: ASSIGN_ROLE_REQUEST_SCHEMA,
      
      // OpenAPI documentation (same schemas, reused)
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: ASSIGN_ROLE_REQUEST_SCHEMA
          }
        }
      },
      
      response: {
        200: {
          ...ASSIGN_ROLE_SUCCESS_RESPONSE_SCHEMA,
          description: 'Role assigned successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Validation error'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Insufficient permissions or cannot change own role'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Not Found - User or role not found'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    }
  }, async (request, reply) => {
    try {
      // TypeScript type assertions (Fastify has already validated)
      const { id } = request.params as ParamsWithId;
      const { role_id } = request.body as AssignRoleRequest;
      
      // Prevent users from changing their own role
      if (request.user?.id === id) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Cannot change your own role'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }
      
      const success = await userService.assignRole(id, role_id);
      
      if (!success) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'User or role not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Get updated user data
      const user = await userService.getUserById(id);

      const successResponse: AssignRoleSuccessResponse = {
        success: true,
        data: user,
        message: 'Role assigned successfully'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error assigning role');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to assign role'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
