import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError, z } from 'zod';
import { createSchema } from 'zod-openapi';
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
    updated_at: z.date().describe('Team last update date'),
    role: z.enum(['team_admin', 'team_user']).describe('User role in the team'),
    is_owner: z.boolean().describe('Whether the user is the owner of this team')
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

  // GET /users - List all users (admin only)
  fastify.get('/users', {
    schema: {
      tags: ['Users'],
      summary: 'List all users',
      description: 'Retrieves a list of all users in the system. Requires admin permissions.',
      security: [{ cookieAuth: [] }],
      response: {
        200: createSchema(usersListResponseSchema.describe('Successfully retrieved users list')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
      }
    },
    preValidation: requirePermission('users.list'),
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

  // GET /users/:id - Get user by ID (own profile or admin)
  fastify.get<{ Params: { id: string } }>('/users/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Get user by ID',
      description: 'Retrieves a specific user by their ID. Users can access their own profile, admins can access any user.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'User ID' }
        },
        required: ['id']
      },
      response: {
        200: createSchema(UserSchema.describe('User data')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Cannot access this user')),
        404: createSchema(errorResponseSchema.describe('Not Found - User not found')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
      }
    },
    preValidation: requireOwnershipOrAdmin(getUserIdFromParams),
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const user = await userService.getUserById(id);
      
      if (!user) {
        const errorResponse = {
          success: false,
          error: 'User not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Create clean response object to avoid serialization issues
      const cleanResponse = {
        id: String(user.id),
        username: String(user.username),
        email: String(user.email),
        first_name: user.first_name ? String(user.first_name) : null,
        last_name: user.last_name ? String(user.last_name) : null,
        role_id: user.role_id ? String(user.role_id) : null,
        auth_type: user.auth_type ? String(user.auth_type) : null,
        github_id: user.github_id ? String(user.github_id) : null
      };

      const jsonString = JSON.stringify(cleanResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      fastify.log.error(error, 'Error fetching user');
      const errorResponse = {
        success: false,
        error: 'Failed to fetch user'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });

  // PUT /users/:id - Update user (own profile or admin)
  fastify.put<{ Params: { id: string }; Body: UpdateUserInput }>('/users/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Update user',
      description: 'Updates user information. Users can update their own profile, admins can update any user.',
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'User ID' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          username: { type: 'string', minLength: 1 },
          email: { type: 'string', format: 'email' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          role_id: { type: 'string' }
        },
        additionalProperties: false,
        minProperties: 1
      },
      response: {
        200: createSchema(userResponseSchema.describe('User updated successfully')),
        400: createSchema(errorResponseSchema.describe('Bad Request - Validation error or invalid role ID')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Cannot update this user or change own role')),
        404: createSchema(errorResponseSchema.describe('Not Found - User not found')),
        409: createSchema(errorResponseSchema.describe('Conflict - Username or email already exists')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
      }
    },
    preValidation: requireOwnershipOrAdmin(getUserIdFromParams),
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const validatedData = UpdateUserSchema.parse(request.body);
      
      // Check if user is authenticated
      if (!request.user) {
        const errorResponse = {
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
          const errorResponse = {
            success: false,
            error: 'Cannot change your own role'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(403).type('application/json').send(jsonString);
        }
      }

      const user = await userService.updateUser(id, validatedData);
      
      if (!user) {
        const errorResponse = {
          success: false,
          error: 'User not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Create clean response with primitive types only
      const cleanResponse = {
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
      const jsonString = JSON.stringify(cleanResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorResponse = {
          success: false,
          error: 'Validation error',
          details: error.issues  // Fixed: error.errors → error.issues for Zod v4
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(400).type('application/json').send(jsonString);
      }
      
      if (error instanceof Error) {
        if (error.message === 'Invalid role ID') {
          const errorResponse = {
            success: false,
            error: 'Invalid role ID'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }
        
        if (error.message === 'Username or email already exists') {
          const errorResponse = {
            success: false,
            error: 'Username or email already exists'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(409).type('application/json').send(jsonString);
        }
        
        if (error.message === 'At least one field (username, first_name, or last_name) must be provided.') {
          const errorResponse = {
            success: false,
            error: 'At least one field (username, first_name, or last_name) must be provided.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }
        
        if (error.message === 'Username is already taken.') {
          const errorResponse = {
            success: false,
            error: 'Username is already taken.'
          };
          const jsonString = JSON.stringify(errorResponse);
          return reply.status(400).type('application/json').send(jsonString);
        }
      }
      
      fastify.log.error(error, 'Error updating user');
      const errorResponse = {
        success: false,
        error: 'Failed to update user'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });

  // DELETE /users/:id - Delete user (admin only)
  fastify.delete<{ Params: { id: string } }>('/users/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Delete user',
      description: 'Deletes a user from the system. Requires admin permissions. Users cannot delete themselves.',
      security: [{ cookieAuth: [] }],
      params: createSchema(paramsWithIdSchema),
      response: {
        200: createSchema(successMessageResponseSchema.describe('User deleted successfully')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions or cannot delete own account')),
        404: createSchema(errorResponseSchema.describe('Not Found - User not found')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
      }
    },
    preValidation: requirePermission('users.delete'),
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

  // PUT /users/:id/role - Assign role to user (admin only)
  fastify.put<{ Params: { id: string }; Body: AssignRoleInput }>('/users/:id/role', {
    schema: {
      tags: ['Users'],
      summary: 'Assign role to user',
      description: 'Assigns a role to a specific user. Requires admin permissions. Users cannot change their own role.',
      security: [{ cookieAuth: [] }],
      params: createSchema(paramsWithIdSchema),
      body: createSchema(AssignRoleSchema),
      response: {
        200: createSchema(userResponseSchema.describe('Role assigned successfully')),
        400: createSchema(errorResponseSchema.describe('Bad Request - Validation error')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions or cannot change own role')),
        404: createSchema(errorResponseSchema.describe('Not Found - User or role not found')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
      }
    },
    preValidation: requirePermission('users.edit'),
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
          details: error.issues,
        });
      }
      
      fastify.log.error(error, 'Error assigning role');
      return reply.status(500).send({
        success: false,
        error: 'Failed to assign role',
      });
    }
  });

  // GET /users/stats - Get user statistics (admin only)
  fastify.get('/users/stats', {
    schema: {
      tags: ['Users'],
      summary: 'Get user statistics',
      description: 'Retrieves user statistics including count by role. Requires admin permissions.',
      security: [{ cookieAuth: [] }],
      response: {
        200: createSchema(userStatsResponseSchema.describe('User statistics retrieved successfully')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
      }
    },
    preValidation: requirePermission('users.list'),
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

  // GET /users/role/:roleId - Get users by role (admin only)
  fastify.get<{ Params: { roleId: string } }>('/users/role/:roleId', {
    schema: {
      tags: ['Users'],
      summary: 'Get users by role',
      description: 'Retrieves all users with a specific role. Requires admin permissions.',
      security: [{ cookieAuth: [] }],
      params: createSchema(roleParamsSchema),
      response: {
        200: createSchema(usersListResponseSchema.describe('Users with specified role retrieved successfully')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
      }
    },
    preValidation: requirePermission('users.list'),
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

  // GET /users/me - Get current user profile
  fastify.get('/users/me', {
    schema: {
      tags: ['Users'],
      summary: 'Get current user profile',
      description: 'Retrieves the profile of the currently authenticated user.',
      security: [{ cookieAuth: [] }],
      response: {
        200: createSchema(UserSchema.describe('Current user profile data')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        404: createSchema(errorResponseSchema.describe('Not Found - User not found')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
      }
    }
  }, async (request, reply) => {
    try {
      if (!request.user) {
        const errorResponse = {
          success: false,
          error: 'Authentication required'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(401).type('application/json').send(jsonString);
      }

      const user = await userService.getUserById(request.user.id);
      
      if (!user) {
        const errorResponse = {
          success: false,
          error: 'User not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      // Create clean response object to avoid serialization issues
      const cleanResponse = {
        id: String(user.id),
        username: String(user.username),
        email: String(user.email),
        first_name: user.first_name ? String(user.first_name) : null,
        last_name: user.last_name ? String(user.last_name) : null,
        role_id: user.role_id ? String(user.role_id) : null,
        auth_type: user.auth_type ? String(user.auth_type) : null,
        github_id: user.github_id ? String(user.github_id) : null
      };

      const jsonString = JSON.stringify(cleanResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      fastify.log.error(error, 'Error fetching current user');
      const errorResponse = {
        success: false,
        error: 'Failed to fetch user profile'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });

  // GET /users/me/teams - Get current user's teams
  fastify.get('/users/me/teams', {
    schema: {
      tags: ['Users'],
      summary: 'Get current user teams',
      description: 'Retrieves all teams that the currently authenticated user belongs to.',
      security: [{ cookieAuth: [] }],
      response: {
        200: createSchema(userTeamsResponseSchema.describe('User teams retrieved successfully')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
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
      
      // Add role information to each team
      const teamsWithRoles = await Promise.all(
        teams.map(async (team) => {
          const membership = await TeamService.getTeamMembership(team.id, request.user!.id);
          return {
            ...team,
            role: membership?.role || 'team_user',
            is_owner: team.owner_id === request.user!.id
          };
        })
      );
      
      // Create clean response object to avoid serialization issues
      const cleanTeams = teamsWithRoles.map(team => ({
        id: String(team.id),
        name: String(team.name),
        slug: String(team.slug),
        description: team.description ? String(team.description) : null,
        owner_id: String(team.owner_id),
        created_at: team.created_at ? team.created_at.toISOString() : null,
        updated_at: team.updated_at ? team.updated_at.toISOString() : null,
        role: String(team.role),
        is_owner: Boolean(team.is_owner)
      }));

      const cleanResponse = {
        success: true,
        teams: cleanTeams
      };

      const jsonString = JSON.stringify(cleanResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      fastify.log.error(error, 'Error fetching user teams');
      const errorResponse = {
        success: false,
        error: 'Failed to fetch user teams'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });

  // GET /users/:id/teams - Get teams for specific user (admin only)
  fastify.get<{ Params: { id: string } }>('/users/:id/teams', {
    schema: {
      tags: ['Users'],
      summary: 'Get user teams by ID',
      description: 'Retrieves all teams for a specific user. Requires admin permissions to view other users\' teams.',
      security: [{ cookieAuth: [] }],
      params: createSchema(paramsWithIdSchema),
      response: {
        200: createSchema(userTeamsResponseSchema.describe('User teams retrieved successfully')),
        401: createSchema(errorResponseSchema.describe('Unauthorized - Authentication required')),
        403: createSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions')),
        404: createSchema(errorResponseSchema.describe('Not Found - User not found')),
        500: createSchema(errorResponseSchema.describe('Internal Server Error'))
      }
    },
    preValidation: requireOwnershipOrAdmin(getUserIdFromParams),
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      
      // Check if user exists
      const targetUser = await userService.getUserById(id);
      if (!targetUser) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
        });
      }

      const teams = await TeamService.getUserTeams(id);
      
      // Add role information to each team
      const teamsWithRoles = await Promise.all(
        teams.map(async (team) => {
          const membership = await TeamService.getTeamMembership(team.id, id);
          return {
            ...team,
            role: membership?.role || 'team_user',
            is_owner: team.owner_id === id
          };
        })
      );
      
      return reply.status(200).send({
        success: true,
        teams: teamsWithRoles,
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
