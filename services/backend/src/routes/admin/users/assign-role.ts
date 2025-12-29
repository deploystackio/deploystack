import type { FastifyInstance } from 'fastify';
import { UserService } from '../../../services/userService';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
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

export default async function assignRoleAdminRoute(server: FastifyInstance) {
  const userService = new UserService();

  // PUT /admin/users/:id/role - Assign role to user (Global Admin only)
  server.put('/users/:id/role', {
    preValidation: requireGlobalAdmin(),
    schema: {
      tags: ['Admin - Users'],
      summary: 'Assign role to user (Global Admin)',
      description: 'Allows global administrators to assign a role to a specific user. Users cannot change their own role. Requires Content-Type: application/json header when sending request body.',
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
          description: 'Forbidden - Cannot change own role'
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

      // Get user's current role before making changes
      const userBeforeChange = await userService.getUserById(id);
      if (!userBeforeChange) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'User not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      const oldRoleId = userBeforeChange.role_id;
      const isPromotionToGlobalAdmin = role_id === 'global_admin' && oldRoleId !== 'global_admin';
      const isDemotionFromGlobalAdmin = oldRoleId === 'global_admin' && role_id !== 'global_admin';

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

      // Send email notifications for global_admin role changes
      if (isPromotionToGlobalAdmin || isDemotionFromGlobalAdmin) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const jobQueueService = (server as any).jobQueueService;
          if (jobQueueService && userBeforeChange.email && request.user) {
            const currentUser = request.user as { id: string; username?: string; email?: string };
            const actorName = currentUser.username || currentUser.email || 'Administrator';
            const targetUserName = userBeforeChange.username || userBeforeChange.email;

            // Email 1: Notify the user whose role changed
            if (isPromotionToGlobalAdmin) {
              await jobQueueService.createJob('send_email', {
                to: userBeforeChange.email,
                subject: 'You\'ve been promoted to Global Administrator',
                template: 'global-admin-promoted',
                variables: {
                  userName: targetUserName,
                  promotedByName: actorName,
                  dashboardUrl: process.env.FRONTEND_URL || undefined
                }
              });
              server.log.info({ operation: 'global_admin_promoted', userId: id }, 'Global admin promotion email queued');
            } else if (isDemotionFromGlobalAdmin) {
              const newRole = await userService.getUserById(id);
              const newRoleName = newRole?.role?.name || 'Standard User';

              await jobQueueService.createJob('send_email', {
                to: userBeforeChange.email,
                subject: 'Your role has been updated',
                template: 'global-admin-demoted',
                variables: {
                  userName: targetUserName,
                  newRoleName: newRoleName,
                  changedByName: actorName,
                  supportEmail: process.env.SUPPORT_EMAIL || undefined
                }
              });
              server.log.info({ operation: 'global_admin_demoted', userId: id }, 'Global admin demotion email queued');
            }

            // Email 2: Notify OTHER global admins (exclude actor and target user)
            const allGlobalAdmins = await userService.getUsersByRole('global_admin');
            const otherAdmins = allGlobalAdmins.filter(admin =>
              admin.id !== request.user!.id && admin.email && admin.id !== id
            );

            if (otherAdmins.length > 0) {
              for (const admin of otherAdmins) {
                const adminDisplayName = admin.username || admin.email;

                if (isPromotionToGlobalAdmin) {
                  await jobQueueService.createJob('send_email', {
                    to: admin.email,
                    subject: 'New Global Administrator Added',
                    template: 'global-admin-user-promoted-notification',
                    variables: {
                      adminName: adminDisplayName,
                      promotedUserName: targetUserName,
                      promotedByName: actorName,
                      dashboardUrl: process.env.FRONTEND_URL || undefined
                    }
                  });
                } else if (isDemotionFromGlobalAdmin) {
                  const newRole = await userService.getUserById(id);
                  const newRoleName = newRole?.role?.name || 'Standard User';

                  await jobQueueService.createJob('send_email', {
                    to: admin.email,
                    subject: 'Global Administrator Removed',
                    template: 'global-admin-user-demoted-notification',
                    variables: {
                      adminName: adminDisplayName,
                      demotedUserName: targetUserName,
                      newRoleName: newRoleName,
                      changedByName: actorName,
                      dashboardUrl: process.env.FRONTEND_URL || undefined
                    }
                  });
                }
              }
              server.log.info({ notifiedCount: otherAdmins.length }, 'Notified other global admins');
            }
          }
        } catch (emailError) {
          server.log.error(emailError, 'Failed to queue emails - role change succeeded');
          // Don't fail role assignment if email queueing fails
        }
      }

      const successResponse: AssignRoleSuccessResponse = {
        success: true,
        data: user,
        message: 'Role assigned successfully'
      };
      const jsonString = JSON.stringify(successResponse);
      return reply.status(200).type('application/json').send(jsonString);
    } catch (error) {
      server.log.error(error, 'Error assigning role in admin route');
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to assign role'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
