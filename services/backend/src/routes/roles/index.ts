import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError, z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { RoleService } from '../../services/roleService';
import { requirePermission } from '../../middleware/roleMiddleware';
import {
  CreateRoleSchema,
  UpdateRoleSchema,
  RoleSchema,
  AVAILABLE_PERMISSIONS,
  type CreateRoleInput,
  type UpdateRoleInput,
} from './schemas';

// Response schemas for roles API
const roleResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: RoleSchema.optional().describe('Role data'),
  message: z.string().optional().describe('Success message')
});

const rolesListResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: z.array(RoleSchema).describe('Array of roles')
});

const permissionsResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: z.object({
    permissions: z.array(z.string()).describe('Array of available permissions'),
    default_roles: z.record(z.string(), z.array(z.string())).describe('Default role permissions mapping')
  }).describe('Permissions and default roles data')
});

const errorResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful (false for errors)').default(false),
  error: z.string().describe('Error message'),
  details: z.any().optional().describe('Additional error details (validation errors, invalid permissions)')
});

const successMessageResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  message: z.string().describe('Success message')
});

const paramsWithIdSchema = z.object({
  id: z.string().describe('Role ID')
});

export default async function rolesRoute(fastify: FastifyInstance) {
  const roleService = new RoleService();

  // GET /api/roles - List all roles
  fastify.get('/api/roles', {
    schema: {
      tags: ['Roles'],
      summary: 'List all roles',
      description: 'Retrieves a list of all roles in the system. Requires role management permissions.',
      security: [{ cookieAuth: [] }],
      response: {
        200: zodToJsonSchema(rolesListResponseSchema.describe('Successfully retrieved roles list'), {
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
    schema: {
      tags: ['Roles'],
      summary: 'Get role by ID',
      description: 'Retrieves a specific role by its ID. Requires role management permissions.',
      security: [{ cookieAuth: [] }],
      params: zodToJsonSchema(paramsWithIdSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(roleResponseSchema.describe('Role data retrieved successfully'), {
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
        404: zodToJsonSchema(errorResponseSchema.describe('Not Found - Role not found'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
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
    schema: {
      tags: ['Roles'],
      summary: 'Create new role',
      description: 'Creates a new role with specified permissions. Requires role management permissions.',
      security: [{ cookieAuth: [] }],
      body: zodToJsonSchema(CreateRoleSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        201: zodToJsonSchema(roleResponseSchema.describe('Role created successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        400: zodToJsonSchema(errorResponseSchema.describe('Bad Request - Validation error or invalid permissions'), {
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
        409: zodToJsonSchema(errorResponseSchema.describe('Conflict - Role ID or name already exists'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preHandler: requirePermission('roles.manage'),
  }, async (request, reply) => {
    try {
      // Fastify has already validated request.body using CreateRoleSchema
      const validatedData = request.body;
      
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
    schema: {
      tags: ['Roles'],
      summary: 'Update role',
      description: 'Updates an existing role. System roles cannot be updated. Requires role management permissions.',
      security: [{ cookieAuth: [] }],
      params: zodToJsonSchema(paramsWithIdSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      body: zodToJsonSchema(UpdateRoleSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(roleResponseSchema.describe('Role updated successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        400: zodToJsonSchema(errorResponseSchema.describe('Bad Request - Validation error or invalid permissions'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions or cannot update system roles'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        404: zodToJsonSchema(errorResponseSchema.describe('Not Found - Role not found'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preHandler: requirePermission('roles.manage'),
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      // Fastify has already validated request.body using UpdateRoleSchema
      const validatedData = request.body;
      
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
    schema: {
      tags: ['Roles'],
      summary: 'Delete role',
      description: 'Deletes a role from the system. System roles and roles assigned to users cannot be deleted. Requires role management permissions.',
      security: [{ cookieAuth: [] }],
      params: zodToJsonSchema(paramsWithIdSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(successMessageResponseSchema.describe('Role deleted successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions or cannot delete system roles'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        404: zodToJsonSchema(errorResponseSchema.describe('Not Found - Role not found'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        409: zodToJsonSchema(errorResponseSchema.describe('Conflict - Cannot delete role that is assigned to users'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
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
    schema: {
      tags: ['Roles'],
      summary: 'Get available permissions',
      description: 'Retrieves all available permissions and default role configurations. Requires role management permissions.',
      security: [{ cookieAuth: [] }],
      response: {
        200: zodToJsonSchema(permissionsResponseSchema.describe('Available permissions and default roles retrieved successfully'), {
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
