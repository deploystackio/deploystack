import type { FastifyInstance } from 'fastify';
import { UserService } from '../../services/userService';
import { requireOwnershipOrAdmin, getUserIdFromParams } from '../../middleware/roleMiddleware';
import { 
  ERROR_RESPONSE_SCHEMA, 
  PARAMS_WITH_ID_SCHEMA, 
  UPDATE_USER_REQUEST_SCHEMA,
  type ErrorResponse,
  type ParamsWithId,
  type UpdateUserRequest
} from './schemas';

// Route-specific Schema Constants

const USER_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { 
      type: 'boolean',
      description: 'Indicates if the operation was successful'
    },
    user: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'User ID' },
        username: { type: 'string', description: 'Username' },
        email: { type: 'string', description: 'Email address' },
        first_name: { type: ['string', 'null'], description: 'First name' },
        last_name: { type: ['string', 'null'], description: 'Last name' },
        role_id: { type: ['string', 'null'], description: 'Role ID' },
        auth_type: { type: ['string', 'null'], description: 'Authentication type' },
        github_id: { type: ['string', 'null'], description: 'GitHub ID if linked' }
      },
      required: ['id', 'username', 'email']
    },
    message: { 
      type: 'string',
      description: 'Success message'
    }
  },
  required: ['success', 'user', 'message']
} as const;

// TypeScript interfaces for route-specific types

interface UserSuccessResponse {
  success: boolean;
  user: {
    id: string;
    username: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    role_id: string | null;
    auth_type: string | null;
    github_id: string | null;
  };
  message: string;
}


export default async function updateUserRoute(server: FastifyInstance) {
  const userService = new UserService();

  // PUT /users/:id - Update user (own profile or admin)
  server.put('/users/:id', {
    preValidation: requireOwnershipOrAdmin(getUserIdFromParams), // ✅ Authorization BEFORE validation
    schema: {
      tags: ['Users'],
      summary: 'Update user',
      description: 'Updates user information. Users can update their own profile, admins can update any user. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      
      // Fastify validation schemas
      params: PARAMS_WITH_ID_SCHEMA,
      body: UPDATE_USER_REQUEST_SCHEMA,
      
      // OpenAPI documentation (same schemas, reused)
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: UPDATE_USER_REQUEST_SCHEMA
          }
        }
      },
      
      response: {
        200: {
          ...USER_SUCCESS_RESPONSE_SCHEMA,
          description: 'User updated successfully'
        },
        400: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Bad Request - Validation error or invalid role ID'
        },
        401: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Unauthorized - Authentication required'
        },
        403: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Forbidden - Cannot update this user or change own role'
        },
        404: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Not Found - User not found'
        },
        409: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Conflict - Username or email already exists'
        },
        500: {
          ...ERROR_RESPONSE_SCHEMA,
          description: 'Internal Server Error'
        }
      }
    },
  }, async (request, reply) => {
    try {
      // TypeScript type assertions (Fastify has already validated)
      const { id } = request.params as ParamsWithId;
      const validatedData = request.body as UpdateUserRequest;
      
      // Check if user is authenticated (should be handled by middleware, but double-check)
      if (!request.user) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Unauthorized: Authentication required.'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(401).type('application/json').send(jsonString);
      }

      // Check if user is trying to change their own role (only admins can do this)
      if (validatedData.role_id !== undefined && request.user.id === id) {
        const hasAdminPermission = await userService.userHasPermission(request.user.id, 'system.admin');
        if (!hasAdminPermission) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: 'Cannot change your own role'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(403).type('application/json').send(jsonString);
        }
      }

      const user = await userService.updateUser(id, validatedData);
      
      if (!user) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'User not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Create clean response with proper types
      const successResponse: UserSuccessResponse = {
        success: true,
        user: {
          id: String(user.id),
          username: String(user.username),
          email: String(user.email),
          first_name: user.first_name ? String(user.first_name) : null,
          last_name: user.last_name ? String(user.last_name) : null,
          role_id: user.role_id ? String(user.role_id) : null,
          auth_type: user.auth_type ? String(user.auth_type) : null,
          github_id: user.github_id ? String(user.github_id) : null
        },
        message: 'Profile updated successfully.'
      };
      
      // Manual JSON serialization
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Invalid role ID') {
          const errorResponse: ErrorResponse = {
            success: false,
            error: 'Invalid role ID'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }
        
        if (error.message === 'Username or email already exists') {
          const errorResponse: ErrorResponse = {
            success: false,
            error: 'Username or email already exists'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(409).type('application/json').send(jsonString);
        }
        
        if (error.message === 'At least one field (username, first_name, or last_name) must be provided.') {
          const errorResponse: ErrorResponse = {
            success: false,
            error: 'At least one field (username, first_name, or last_name) must be provided.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }
        
        if (error.message === 'Username is already taken.') {
          const errorResponse: ErrorResponse = {
            success: false,
            error: 'Username is already taken.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }
      }
      
      server.log.error(error, 'Error updating user');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to update user'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
