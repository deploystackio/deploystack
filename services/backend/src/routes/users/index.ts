import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { UserService } from '../../services/userService';
import { requirePermission, requireOwnershipOrAdmin, getUserIdFromParams } from '../../middleware/roleMiddleware';
import {
  UpdateUserSchema,
  AssignRoleSchema,
  type UpdateUserInput,
  type AssignRoleInput,
} from '../roles/schemas';

export default async function usersRoute(fastify: FastifyInstance) {
  const userService = new UserService();

  // GET /api/users - List all users (admin only)
  fastify.get('/api/users', {
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

      return reply.status(200).send({
        success: true,
        data: user,
      });
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
  fastify.get('/api/users/me', async (request, reply) => {
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

      return reply.status(200).send({
        success: true,
        data: user,
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching current user');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch user profile',
      });
    }
  });
}
