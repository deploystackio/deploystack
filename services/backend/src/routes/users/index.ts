import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError, z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { UserService } from '../../services/userService';
import { TeamService } from '../../services/teamService';
import { requirePermission, requireOwnershipOrAdmin, getUserIdFromParams } from '../../middleware/roleMiddleware';
import {
  UpdateUserSchema,
  AssignRoleSchema,
  UserSchema,
  type UpdateUserInput,
  type AssignRoleInput,
} from '../roles/schemas';

// Additional response schemas for users API
const userResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: UserSchema.optional().describe('User data'),
  message: z.string().optional().describe('Success message')
});

const usersListResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: z.array(UserSchema).describe('Array of users')
});

const userStatsResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: z.object({
    user_count_by_role: z.record(z.string(), z.number()).describe('Count of users by role')
  }).describe('User statistics data')
});

const userTeamsResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  teams: z.array(z.object({
    id: z.string().describe('Team ID'),
    name: z.string().describe('Team name'),
    slug: z.string().describe('Team slug'),
    description: z.string().nullable().describe('Team description'),
    owner_id: z.string().describe('Team owner ID'),
    created_at: z.date().describe('Team creation date'),
    updated_at: z.date().describe('Team last update date')
  })).describe('Array of user teams')
});

const errorResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful (false for errors)').default(false),
  error: z.string().describe('Error message'),
  details: z.array(z.any()).optional().describe('Additional error details (validation errors)')
});

const successMessageResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  message: z.string().describe('Success message')
});

const paramsWithIdSchema = z.object({
  id: z.string().describe('User ID')
});

const roleParamsSchema = z.object({
  roleId: z.string().describe('Role ID')
});

export default async function usersRoute(fastify: FastifyInstance) {
  const userService = new UserService();

  // GET /api/users - List all users (admin only)
  fastify.get('/api/users', {
    schema: {
      tags: ['Users'],
      summary: 'List all users',
      description: 'Retrieves a list of all users in the system. Requires admin permissions.',
      security: [{ cookieAuth: [] }],
      response: {
        200: zodToJsonSchema(usersListResponseSchema.describe('Successfully retrieved users list'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preHandler: requirePermission('users.list'),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const users = await userService.getAllUsers();
      return reply.status(200).send({
        success: true,
        data: users,
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching users');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch users',
      });
    }
  });

  // GET /api/users/:id - Get user by ID (own profile or admin)
  fastify.get<{ Params: { id: string } }>('/api/users/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Get user by ID',
      description: 'Retrieves a specific user by their ID. Users can access their own profile, admins can access any user.',
      security: [{ cookieAuth: [] }],
      params: zodToJsonSchema(paramsWithIdSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(UserSchema.describe('User data'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Cannot access this user'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        404: zodToJsonSchema(errorResponseSchema.describe('Not Found - User not found'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preHandler: requireOwnershipOrAdmin(getUserIdFromParams),
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const user = await userService.getUserById(id);
      
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
        });
      }

      return reply.status(200).send(user);
    } catch (error) {
      fastify.log.error(error, 'Error fetching user');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch user',
      });
    }
  });

  // PUT /api/users/:id - Update user (own profile or admin)
  fastify.put<{ Params: { id: string }; Body: UpdateUserInput }>('/api/users/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Update user',
      description: 'Updates user information. Users can update their own profile, admins can update any user.',
      security: [{ cookieAuth: [] }],
      params: zodToJsonSchema(paramsWithIdSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      body: zodToJsonSchema(UpdateUserSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(userResponseSchema.describe('User updated successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        400: zodToJsonSchema(errorResponseSchema.describe('Bad Request - Validation error or invalid role ID'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Cannot update this user or change own role'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        404: zodToJsonSchema(errorResponseSchema.describe('Not Found - User not found'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        409: zodToJsonSchema(errorResponseSchema.describe('Conflict - Username or email already exists'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preHandler: requireOwnershipOrAdmin(getUserIdFromParams),
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const validatedData = UpdateUserSchema.parse(request.body);
      
      // Check if user is trying to change their own role (only admins can do this)
      if (validatedData.role_id !== undefined && request.user?.id === id) {
        const hasAdminPermission = await userService.userHasPermission(request.user.id, 'system.admin');
        if (!hasAdminPermission) {
          return reply.status(403).send({
            success: false,
            error: 'Cannot change your own role',
          });
        }
      }

      const user = await userService.updateUser(id, validatedData);
      
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
        });
      }

      return reply.status(200).send({
        success: true,
        data: user,
        message: 'User updated successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }
      
      if (error instanceof Error) {
        if (error.message === 'Invalid role ID') {
          return reply.status(400).send({
            success: false,
            error: 'Invalid role ID',
          });
        }
        
        if (error.message === 'Username or email already exists') {
          return reply.status(409).send({
            success: false,
            error: 'Username or email already exists',
          });
        }
      }
      
      fastify.log.error(error, 'Error updating user');
      return reply.status(500).send({
        success: false,
        error: 'Failed to update user',
      });
    }
  });

  // DELETE /api/users/:id - Delete user (admin only)
  fastify.delete<{ Params: { id: string } }>('/api/users/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Delete user',
      description: 'Deletes a user from the system. Requires admin permissions. Users cannot delete themselves.',
      security: [{ cookieAuth: [] }],
      params: zodToJsonSchema(paramsWithIdSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(successMessageResponseSchema.describe('User deleted successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions or cannot delete own account'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        404: zodToJsonSchema(errorResponseSchema.describe('Not Found - User not found'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preHandler: requirePermission('users.delete'),
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      
      // Prevent users from deleting themselves
      if (request.user?.id === id) {
        return reply.status(403).send({
          success: false,
          error: 'Cannot delete your own account',
        });
      }
      
      const success = await userService.deleteUser(id);
      
      if (!success) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
        });
      }

      return reply.status(200).send({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Cannot delete the last global administrator') {
        return reply.status(403).send({
          success: false,
          error: 'Cannot delete the last global administrator',
        });
      }
      
      fastify.log.error(error, 'Error deleting user');
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete user',
      });
    }
  });

  // PUT /api/users/:id/role - Assign role to user (admin only)
  fastify.put<{ Params: { id: string }; Body: AssignRoleInput }>('/api/users/:id/role', {
    schema: {
      tags: ['Users'],
      summary: 'Assign role to user',
      description: 'Assigns a role to a specific user. Requires admin permissions. Users cannot change their own role.',
      security: [{ cookieAuth: [] }],
      params: zodToJsonSchema(paramsWithIdSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      body: zodToJsonSchema(AssignRoleSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(userResponseSchema.describe('Role assigned successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        400: zodToJsonSchema(errorResponseSchema.describe('Bad Request - Validation error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions or cannot change own role'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        404: zodToJsonSchema(errorResponseSchema.describe('Not Found - User or role not found'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preHandler: requirePermission('users.edit'),
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { role_id } = AssignRoleSchema.parse(request.body);
      
      // Prevent users from changing their own role
      if (request.user?.id === id) {
        return reply.status(403).send({
          success: false,
          error: 'Cannot change your own role',
        });
      }
      
      const success = await userService.assignRole(id, role_id);
      
      if (!success) {
        return reply.status(404).send({
          success: false,
          error: 'User or role not found',
        });
      }

      // Get updated user data
      const user = await userService.getUserById(id);

      return reply.status(200).send({
        success: true,
        data: user,
        message: 'Role assigned successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }
      
      fastify.log.error(error, 'Error assigning role');
      return reply.status(500).send({
        success: false,
        error: 'Failed to assign role',
      });
    }
  });

  // GET /api/users/stats - Get user statistics (admin only)
  fastify.get('/api/users/stats', {
    schema: {
      tags: ['Users'],
      summary: 'Get user statistics',
      description: 'Retrieves user statistics including count by role. Requires admin permissions.',
      security: [{ cookieAuth: [] }],
      response: {
        200: zodToJsonSchema(userStatsResponseSchema.describe('User statistics retrieved successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preHandler: requirePermission('users.list'),
  }, async (request, reply) => {
    try {
      const userCountByRole = await userService.getUserCountByRole();
      
      return reply.status(200).send({
        success: true,
        data: {
          user_count_by_role: userCountByRole,
        },
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching user statistics');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch user statistics',
      });
    }
  });

  // GET /api/users/role/:roleId - Get users by role (admin only)
  fastify.get<{ Params: { roleId: string } }>('/api/users/role/:roleId', {
    schema: {
      tags: ['Users'],
      summary: 'Get users by role',
      description: 'Retrieves all users with a specific role. Requires admin permissions.',
      security: [{ cookieAuth: [] }],
      params: zodToJsonSchema(roleParamsSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(usersListResponseSchema.describe('Users with specified role retrieved successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preHandler: requirePermission('users.list'),
  }, async (request, reply) => {
    try {
      const { roleId } = request.params;
      const users = await userService.getUsersByRole(roleId);
      
      return reply.status(200).send({
        success: true,
        data: users,
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching users by role');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch users by role',
      });
    }
  });

  // GET /api/users/me - Get current user profile
  fastify.get('/api/users/me', {
    schema: {
      tags: ['Users'],
      summary: 'Get current user profile',
      description: 'Retrieves the profile of the currently authenticated user.',
      security: [{ cookieAuth: [] }],
      response: {
        200: zodToJsonSchema(UserSchema.describe('Current user profile data'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        404: zodToJsonSchema(errorResponseSchema.describe('Not Found - User not found'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    }
  }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      const user = await userService.getUserById(request.user.id);
      
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
        });
      }

      return reply.status(200).send(user);
    } catch (error) {
      fastify.log.error(error, 'Error fetching current user');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch user profile',
      });
    }
  });

  // GET /api/users/me/teams - Get current user's teams
  fastify.get('/api/users/me/teams', {
    schema: {
      tags: ['Users'],
      summary: 'Get current user teams',
      description: 'Retrieves all teams that the currently authenticated user belongs to.',
      security: [{ cookieAuth: [] }],
      response: {
        200: zodToJsonSchema(userTeamsResponseSchema.describe('User teams retrieved successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    }
  }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      const teams = await TeamService.getUserTeams(request.user.id);
      
      return reply.status(200).send({
        success: true,
        teams: teams,
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching user teams');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch user teams',
      });
    }
  });
}
