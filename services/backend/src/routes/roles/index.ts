import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { RoleService } from '../../services/roleService';
import { requirePermission } from '../../middleware/roleMiddleware';
import {
  CreateRoleSchema,
  UpdateRoleSchema,
  AVAILABLE_PERMISSIONS,
  type CreateRoleInput,
  type UpdateRoleInput,
} from './schemas';

export default async function rolesRoute(fastify: FastifyInstance) {
  const roleService = new RoleService();

  // GET /api/roles - List all roles
  fastify.get('/api/roles', {
    preHandler: requirePermission('roles.manage'),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const roles = await roleService.getAllRoles();
      return reply.status(200).send({
        success: true,
        data: roles,
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching roles');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch roles',
      });
    }
  });

  // GET /api/roles/:id - Get role by ID
  fastify.get<{ Params: { id: string } }>('/api/roles/:id', {
    preHandler: requirePermission('roles.manage'),
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const role = await roleService.getRoleById(id);
      
      if (!role) {
        return reply.status(404).send({
          success: false,
          error: 'Role not found',
        });
      }

      return reply.status(200).send({
        success: true,
        data: role,
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching role');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch role',
      });
    }
  });

  // POST /api/roles - Create new role
  fastify.post<{ Body: CreateRoleInput }>('/api/roles', {
    preHandler: requirePermission('roles.manage'),
  }, async (request, reply) => {
    try {
      const validatedData = CreateRoleSchema.parse(request.body);
      
      // Validate permissions
      const invalidPermissions = validatedData.permissions.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        perm => !AVAILABLE_PERMISSIONS.includes(perm as any)
      );
      
      if (invalidPermissions.length > 0) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid permissions',
          details: { invalid_permissions: invalidPermissions },
        });
      }

      const role = await roleService.createRole(validatedData);
      
      return reply.status(201).send({
        success: true,
        data: role,
        message: 'Role created successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }
      
      fastify.log.error(error, 'Error creating role');
      
      if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
        return reply.status(409).send({
          success: false,
          error: 'Role ID or name already exists',
        });
      }
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to create role',
      });
    }
  });

  // PUT /api/roles/:id - Update role
  fastify.put<{ Params: { id: string }; Body: UpdateRoleInput }>('/api/roles/:id', {
    preHandler: requirePermission('roles.manage'),
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const validatedData = UpdateRoleSchema.parse(request.body);
      
      // Validate permissions if provided
      if (validatedData.permissions) {
        const invalidPermissions = validatedData.permissions.filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          perm => !AVAILABLE_PERMISSIONS.includes(perm as any)
        );
        
        if (invalidPermissions.length > 0) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid permissions',
            details: { invalid_permissions: invalidPermissions },
          });
        }
      }

      const role = await roleService.updateRole(id, validatedData);
      
      if (!role) {
        return reply.status(404).send({
          success: false,
          error: 'Role not found',
        });
      }

      return reply.status(200).send({
        success: true,
        data: role,
        message: 'Role updated successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }
      
      if (error instanceof Error && error.message === 'Cannot update system roles') {
        return reply.status(403).send({
          success: false,
          error: 'Cannot update system roles',
        });
      }
      
      fastify.log.error(error, 'Error updating role');
      return reply.status(500).send({
        success: false,
        error: 'Failed to update role',
      });
    }
  });

  // DELETE /api/roles/:id - Delete role
  fastify.delete<{ Params: { id: string } }>('/api/roles/:id', {
    preHandler: requirePermission('roles.manage'),
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const success = await roleService.deleteRole(id);
      
      if (!success) {
        return reply.status(404).send({
          success: false,
          error: 'Role not found',
        });
      }

      return reply.status(200).send({
        success: true,
        message: 'Role deleted successfully',
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Cannot delete system roles') {
          return reply.status(403).send({
            success: false,
            error: 'Cannot delete system roles',
          });
        }
        
        if (error.message === 'Cannot delete role that is assigned to users') {
          return reply.status(409).send({
            success: false,
            error: 'Cannot delete role that is assigned to users',
          });
        }
      }
      
      fastify.log.error(error, 'Error deleting role');
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete role',
      });
    }
  });

  // GET /api/roles/permissions - Get available permissions
  fastify.get('/api/roles/permissions', {
    preHandler: requirePermission('roles.manage'),
  }, async (request, reply) => {
    return reply.status(200).send({
      success: true,
      data: {
        permissions: AVAILABLE_PERMISSIONS,
        default_roles: RoleService.getDefaultPermissions(),
      },
    });
  });
}
